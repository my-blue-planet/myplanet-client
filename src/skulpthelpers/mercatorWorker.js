class MercatorWorkerJS {
	static EarthRadius = 6378137
	static metersPerPixel(latitude, zoomLevel) {
		return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * this.EarthRadius / this.getMapSize(zoomLevel);
	}
	static getMapSize(zoomLevel) {
		return Math.ceil(256 * Math.pow(2, zoomLevel));
	}
	static clip(n, minValue, maxValue) {
		return Math.min(Math.max(n, minValue), maxValue);
	}
	static worldPixelToPosition(px, py, zoomLevel) {
		var mapSize = this.getMapSize(zoomLevel);
		var x = (this.clip(px, 0, mapSize - 1) / mapSize) - 0.5;
		var y = 0.5 - (this.clip(py, 0, mapSize - 1) / mapSize);
		return [
			360 * x,    //Longitude
			90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI  //Latitude
		];
	}
}

const $builtinmodule = function (name) {

	const module = {};

	module.metersPerPixel = new Sk.builtin.func(function(latitudePyNum, zoomLevelPyNum) {
		let jsLat = Sk.ffi.remapToJs(latitudePyNum)
		let jsZoomLevel = Sk.ffi.remapToJs(zoomLevelPyNum)
		let metersPerP = MercatorWorkerJS.metersPerPixel(jsLat, jsZoomLevel)
		return Sk.ffi.remapToPy(metersPerP)
	});

	module.worldPixelToPosition = new Sk.builtin.func(function(pxPy, pyPy, zoomLevelPy) {
		let pxJs = Sk.ffi.remapToJs(pxPy)
		let pyJs = Sk.ffi.remapToJs(pyPy)
		let zoomLevelJs = Sk.ffi.remapToJs(zoomLevelPy)
		let longLat = MercatorWorkerJS.worldPixelToPosition(pxJs, pyJs, zoomLevelJs)
		return Sk.ffi.remapToPy(longLat)
	});

	return module;
}