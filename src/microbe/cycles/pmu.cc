#define NAPI_VERSION 8
#include <node_api.h>
#include <stdint.h>
#include <string.h>

#if defined(__linux__)
#include <unistd.h>
#include <sys/syscall.h>
#include <linux/perf_event.h>
#include <sched.h>
#include <errno.h>

struct perf_group_data {
  uint64_t nr;
  struct {
    uint64_t val;
  } v[2];
};

static thread_local int g_fd_leader = -1;
static thread_local int g_fd_member = -1;
static thread_local uint64_t g_start_cycles = 0;
static thread_local uint64_t g_start_instructions = 0;
static thread_local uint64_t g_end_cycles = 0;
static thread_local uint64_t g_end_instructions = 0;
static thread_local bool g_tic_called = false;
static thread_local bool g_toc_called = false;

static bool pin_thread(int core_id = -1) {
  long nprocs = sysconf(_SC_NPROCESSORS_ONLN);
  if (nprocs <= 0) nprocs = 1;
  int target = core_id;
  if (target < 0 || target >= nprocs) {
    target = (nprocs >= 4) ? 2 : (nprocs >= 2 ? 1 : 0);
  }
  cpu_set_t cpuset;
  CPU_ZERO(&cpuset);
  CPU_SET(target, &cpuset);
  return sched_setaffinity(0, sizeof(cpuset), &cpuset) == 0;
}

static bool init_thread_pmu() {
  if (g_fd_leader >= 0) {
    return true;
  }

  pin_thread();

  struct perf_event_attr pe_cycles;
  memset(&pe_cycles, 0, sizeof(pe_cycles));
  pe_cycles.type = PERF_TYPE_HARDWARE;
  pe_cycles.size = sizeof(pe_cycles);
  pe_cycles.config = PERF_COUNT_HW_CPU_CYCLES;
  pe_cycles.read_format = PERF_FORMAT_GROUP;
  pe_cycles.exclude_kernel = 1;
  pe_cycles.exclude_hv = 1;

  g_fd_leader = syscall(__NR_perf_event_open, &pe_cycles, 0, -1, -1, 0);
  if (g_fd_leader < 0) {
    return false;
  }

  struct perf_event_attr pe_ins;
  memset(&pe_ins, 0, sizeof(pe_ins));
  pe_ins.type = PERF_TYPE_HARDWARE;
  pe_ins.size = sizeof(pe_ins);
  pe_ins.config = PERF_COUNT_HW_INSTRUCTIONS;
  pe_ins.exclude_kernel = 1;
  pe_ins.exclude_hv = 1;

  g_fd_member = syscall(__NR_perf_event_open, &pe_ins, 0, -1, g_fd_leader, 0);
  if (g_fd_member < 0) {
    close(g_fd_leader);
    g_fd_leader = -1;
    return false;
  }

  return true;
}

static napi_value IsSupported(napi_env env, napi_callback_info info) {
  bool ok = init_thread_pmu();
  napi_value res;
  napi_get_boolean(env, ok, &res);
  return res;
}

static napi_value Tic(napi_env env, napi_callback_info info) {
  if (!init_thread_pmu()) {
    return nullptr;
  }
  struct perf_group_data data;
  if (read(g_fd_leader, &data, sizeof(data)) == sizeof(data)) {
    g_start_cycles = data.v[0].val;
    g_start_instructions = data.v[1].val;
    g_tic_called = true;
  }
  return nullptr;
}

static napi_value Toc(napi_env env, napi_callback_info info) {
  if (g_fd_leader < 0) {
    return nullptr;
  }
  struct perf_group_data data;
  if (read(g_fd_leader, &data, sizeof(data)) == sizeof(data)) {
    g_end_cycles = data.v[0].val;
    g_end_instructions = data.v[1].val;
    g_toc_called = true;
  }
  return nullptr;
}

static napi_value Elapsed(napi_env env, napi_callback_info info) {
  napi_value obj;
  napi_create_object(env, &obj);

  if (!g_tic_called || !g_toc_called || g_end_cycles < g_start_cycles) {
    g_tic_called = false;
    g_toc_called = false;
    napi_value neg;
    napi_create_double(env, -1.0, &neg);
    napi_set_named_property(env, obj, "cycles", neg);
    napi_set_named_property(env, obj, "instructions", neg);
    napi_set_named_property(env, obj, "ipc", neg);
    return obj;
  }

  double cycles = static_cast<double>(g_end_cycles - g_start_cycles);
  double ins = static_cast<double>(g_end_instructions >= g_start_instructions
    ? (g_end_instructions - g_start_instructions)
    : 0);
  double ipc = cycles > 0 ? (ins / cycles) : 0.0;

  g_tic_called = false;
  g_toc_called = false;

  napi_value v_cycles, v_ins, v_ipc;
  napi_create_double(env, cycles, &v_cycles);
  napi_create_double(env, ins, &v_ins);
  napi_create_double(env, ipc, &v_ipc);

  napi_set_named_property(env, obj, "cycles", v_cycles);
  napi_set_named_property(env, obj, "instructions", v_ins);
  napi_set_named_property(env, obj, "ipc", v_ipc);

  return obj;
}

static napi_value PinCore(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
  int core = -1;
  if (argc >= 1) {
    int32_t val;
    if (napi_get_value_int32(env, args[0], &val) == napi_ok) {
      core = val;
    }
  }
  bool ok = pin_thread(core);
  napi_value res;
  napi_get_boolean(env, ok, &res);
  return res;
}

static napi_value GetCore(napi_env env, napi_callback_info info) {
  int core = sched_getcpu();
  napi_value res;
  napi_create_int32(env, core, &res);
  return res;
}

#else

static napi_value IsSupported(napi_env env, napi_callback_info info) {
  napi_value res;
  napi_get_boolean(env, false, &res);
  return res;
}

static napi_value Tic(napi_env env, napi_callback_info info) { return nullptr; }
static napi_value Toc(napi_env env, napi_callback_info info) { return nullptr; }
static napi_value Elapsed(napi_env env, napi_callback_info info) {
  napi_value obj;
  napi_create_object(env, &obj);
  napi_value neg;
  napi_create_double(env, -1.0, &neg);
  napi_set_named_property(env, obj, "cycles", neg);
  napi_set_named_property(env, obj, "instructions", neg);
  napi_set_named_property(env, obj, "ipc", neg);
  return obj;
}

static napi_value PinCore(napi_env env, napi_callback_info info) {
  napi_value res;
  napi_get_boolean(env, false, &res);
  return res;
}

static napi_value GetCore(napi_env env, napi_callback_info info) {
  napi_value res;
  napi_create_int32(env, -1, &res);
  return res;
}

#endif

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
    { "isSupported", nullptr, IsSupported, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "tic", nullptr, Tic, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "toc", nullptr, Toc, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "elapsed", nullptr, Elapsed, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "pinCore", nullptr, PinCore, nullptr, nullptr, nullptr, napi_default, nullptr },
    { "getCore", nullptr, GetCore, nullptr, nullptr, nullptr, napi_default, nullptr },
  };
  napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
