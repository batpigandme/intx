{
  "targets": [
    {
      "target_name": "pmu",
      "sources": [ "pmu.cc" ],
      "cflags_cc": [ "-O3", "-fomit-frame-pointer", "-Wno-missing-profile" ],
      "cflags": [ "-O3", "-fomit-frame-pointer", "-Wno-missing-profile" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ]
    }
  ]
}
