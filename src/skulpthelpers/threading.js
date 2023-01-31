const $builtinmodule = function (name) {

	const mod = {};

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