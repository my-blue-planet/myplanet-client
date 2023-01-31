
export async function createSpeechFolders() {
  const nj = await fetch(`/files/Neujahrsansprachen.json`).then(r=>r.json());
  const inaug = await fetch(`/files/InaugurationSpeeches.json`).then(r=>r.json());
  let virtualFilesObj = {};
  Object.keys(inaug).forEach(f=>virtualFilesObj["Inauguration/"+f] = inaug[f]);
  Object.keys(nj).forEach(f=>virtualFilesObj["Neujahr/"+f] = nj[f]);
  return virtualFilesObj;
}

//console.log(JSON.stringify(fileListToObj({"aa.txt": "a", "a/aa.txt": "nested a", "a/bb.txt": "nested b", "c/d/e/f.txt": "OK!"})));

function fileListToObj(fileList) {
  let paths = {[""]: []};
  Object.keys(fileList).forEach(filepath=>{
    let currentpath = "";
    let parts = filepath.split("/");
    parts.forEach((part, index) => {
      if(!paths[currentpath].includes(part)) paths[currentpath].push(part)
      if(index < parts.length - 1) {
        currentpath += (index === 0 ? "" : "/") + part;
        if(!(currentpath in paths)) paths[currentpath] = [];
      }
    });
  });
  return paths;
}

export async function createLibObj(virtualFilesObj) {
  console.log(virtualFilesObj);
  //@check: supports only one nested level
  let dirobj = fileListToObj(virtualFilesObj);
  return {
    ...virtualFilesObj, "src/lib/os.js": `
  var $builtinmodule = function (name) {
      var mod = {};
      mod.listdir = new Sk.builtin.func(function (path) {
          Sk.builtin.pyCheckArgsLen("listdir", arguments.length, 1, 1);
          Sk.builtin.pyCheckType("path", "string", Sk.builtin.checkString(path));
          let p = Sk.ffi.remapToJs(path);
          let dirobj = ${JSON.stringify(dirobj)};
          let arr = dirobj[p] || dirobj["./"+p] || dirobj["."+p] || "";
          return Sk.ffi.remapToPy(arr);
      });
      return mod;
    }
    `
  };
}

//test js lib example, echo function not used
export function addBuiltinModule() {
  return {
    "src/lib/fetch.js": `
    var $builtinmodule = function (name) {
      var mod = {};
      mod.get = new Sk.builtin.func(function (num) {
          Sk.builtin.pyCheckArgsLen("listdir", arguments.length, 1, 1);
          Sk.builtin.pyCheckType("num", "integer", Sk.builtin.checkInt(num));
          let p = Sk.ffi.remapToJs(num);
          let n = p
          return Sk.ffi.remapToPy(n);
      });
      return mod;
    }
    `
  };
}

//x_test Suspensions
export function x_addSuspension() {
  return {
    "src/lib/fetch.js": `
    var $builtinmodule = function (name) {
      var mod = {};
      mod.get = new Sk.builtin.func(function(num) {
            var susp = new Sk.misceval.Suspension();
            // susp.resume is called on the Promise's resolve() - you must return a Skulpt type
            susp.resume = function (n) {
                if (susp.data["error"]) {
                    throw new Sk.builtin.IOError(susp.data["error"].message);
                }
                return Sk.ffi.remapToPy(susp.data.result);
            }
            susp.data = {
                type: "Sk.promise",
                promise: new Promise(function (resolve, reject) {
                    setTimeout(_=>console.log(999) || resolve(42), 3000)
                    console.log(888)
                })
            };
            return susp;
      });
      return mod;
    }
    `
  };
}

//threading, use threading.parallel([fn1, fn2])
//threading, use threading.add(fn, arg1, ...)
export function addThreading() {
  return {
    "src/lib/threading.js": `
    var $builtinmodule = function (name) {
      var mod = {};
      mod.parallel = new Sk.builtin.func(function(pyfns) {
            var susp = new Sk.misceval.Suspension();
            susp.resume = function (n) {
                if (susp.data["error"]) {
                    throw new Sk.builtin.IOError(susp.data["error"].message);
                }
                return Sk.ffi.remapToPy(susp.data.result);
            }
            susp.data = {
                type: "Sk.promise",
                promise: Promise.all(pyfns.v.map(pyfn => {
                      return Sk.misceval.callsimAsync(null, pyfn)
                    }))
            };
            return susp;
      });
      mod.add = new Sk.builtin.func(function(pyfn, ...args) {
            var susp = new Sk.misceval.Suspension();
            let done = false;
            let result = Sk.ffi.remapToPy("undefined");
            let thread = {
              isDone: function() {return done},
              getResult: function() {return result}
            }
            susp.resume = function (n) {
                Sk.misceval.callsimAsync(null, pyfn, ...args).then(x=>{
                    result = Sk.ffi.remapToPy(x);
                    done = true;
                })
                if (susp.data["error"]) {
                    throw new Sk.builtin.IOError(susp.data["error"].message);
                }
                return Sk.ffi.remapToPy(susp.data.result);
            }
            susp.data = {
                type: "Sk.promise",
                promise: Promise.resolve(thread)
            };
            return susp;
      });
      mod.wait = new Sk.builtin.func(function(pymillis) {
            var susp = new Sk.misceval.Suspension();
            let millis = Sk.ffi.remapToJs(pymillis);
            susp.resume = function (n) {
                return Sk.ffi.remapToPy(susp.data.result);
            }
            susp.data = {
                type: "Sk.promise",
                promise: new Promise((resolve, reject) => setTimeout(_=>resolve(millis), millis))
            };
            return susp;
      });
      return mod;
    }
    `
  };
}