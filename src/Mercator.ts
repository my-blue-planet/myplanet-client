export class Mercator {

	//Earth radius in meters.
	private static EarthRadius = 6378137;

	private static MinLatitude = -85.05112878;
	private static MaxLatitude = 85.05112878;
	private static MinLongitude = -180;
	private static MaxLongitude = 180;

	private static clip(n: number, minValue: number, maxValue: number): number {
		return Math.min(Math.max(n, minValue), maxValue);
	}

	public static getMapSize(zoom: number, tileSize = 256): number {
		return Math.ceil(tileSize * Math.pow(2, zoom));
	}

	public static metersPerPixel(latitude: number, zoom: number, tileSize = 256): number {
		latitude = this.clip(latitude, this.MinLatitude, this.MaxLatitude);
		return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * this.EarthRadius / this.getMapSize(zoom, tileSize);
	}

	public static MapScale(latitude: number, zoom: number, screenDpi: number, tileSize = 256): number {
		return this.metersPerPixel(latitude, zoom, tileSize) * screenDpi / 0.0254;
	}

	public static worldPixelToPosition(pixel: number[], zoom: number, tileSize = 256): [number, number] {
		var mapSize = this.getMapSize(zoom, tileSize);

		var x = (this.clip(pixel[0], 0, mapSize - 1) / mapSize) - 0.5;
		var y = 0.5 - (this.clip(pixel[1], 0, mapSize - 1) / mapSize);

		return [
			360 * x,    //Longitude
			90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI  //Latitude
		];
	}

	public static positionToWorldPixel(position: number[], zoom: number, tileSize = 256): number[] {
		const latitude = this.clip(position[1], this.MinLatitude, this.MaxLatitude);
		const longitude = this.clip(position[0], this.MinLongitude, this.MaxLongitude);

		const x = (longitude + 180) / 360;
		const sinLatitude = Math.sin(latitude * Math.PI / 180);
		const y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

		var mapSize = this.getMapSize(zoom, tileSize);

		return [
			this.clip(x * mapSize + 0.5, 0, mapSize - 1),
			this.clip(y * mapSize + 0.5, 0, mapSize - 1)
		];
	}

	public static worldPixelToTileXY(pixel: number[], tileSize = 256): { tileX: number, tileY: number } {
		return {
			tileX: Math.round(pixel[0] / tileSize),
			tileY: Math.round(pixel[1] / tileSize)
		};
	}

	public static tileXYToWorldPixel(tileX: number, tileY: number, tileSize = 256): number[] {
		return [tileX * tileSize, tileY * tileSize];
	}

	public static tileXYToQuadKey(tileX: number, tileY: number, zoom: number): string {
		var quadKey: number[] = [];
		for (var i = zoom; i > 0; i--) {
			var digit = 0;
			var mask = 1 << (i - 1);

			if ((tileX & mask) != 0) {
				digit++;
			}

			if ((tileY & mask) != 0) {
				digit += 2
			}

			quadKey.push(digit);
		}
		return quadKey.join('');
	}

	public static quadKeyToTileXY(quadKey: string): { tileX: number, tileY: number, zoom: number } {
		var tileX = 0;
		var tileY = 0;
		var zoom = quadKey.length;

		for (var i = zoom; i > 0; i--) {
			var mask = 1 << (i - 1);
			switch (quadKey[zoom - i]) {
				case '0':
					break;

				case '1':
					tileX |= mask;
					break;

				case '2':
					tileY |= mask;
					break;

				case '3':
					tileX |= mask;
					tileY |= mask;
					break;

				default:
					throw "Invalid QuadKey digit sequence.";
			}
		}

		return {
			tileX: tileX,
			tileY: tileY,
			zoom: zoom
		};
	}

	public static positionToTileXY(position: number[], zoom: number, tileSize = 256): { tileX: number, tileY: number } {
		var latitude = this.clip(position[1], this.MinLatitude, this.MaxLatitude);
		var longitude = this.clip(position[0], this.MinLongitude, this.MaxLongitude);

		var x = (longitude + 180) / 360;
		var sinLatitude = Math.sin(latitude * Math.PI / 180);
		var y = 0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI);

		//tileSize needed in calculations as in rare cases the multiplying/rounding/dividing can make the difference of a pixel which can result in a completely different tile.
		var mapSize = this.getMapSize(zoom, tileSize);

		return {
			tileX: Math.floor(this.clip(x * mapSize + 0.5, 0, mapSize - 1) / tileSize),
			tileY: Math.floor(this.clip(y * mapSize + 0.5, 0, mapSize - 1) / tileSize)
		};
	}

	public static GetQuadkeysInView(position: number[], zoom: number, width: number, height: number, tileSize = 256): string[] {
		var p = this.positionToWorldPixel(position, zoom, tileSize);

		var top = p[1] - height * 0.5;
		var left = p[0] - width * 0.5;

		var bottom = p[1] + height * 0.5;
		var right = p[0] + width * 0.5;

		var tl = this.worldPixelToPosition([left, top], zoom, tileSize);
		var br = this.worldPixelToPosition([right, bottom], zoom, tileSize);

		//Boudning box in the format: [west, south, east, north];
		var bounds = [tl[0], br[1], br[0], tl[1]];

		return this.getQuadkeysInBoundingBox(bounds, zoom, tileSize);
	}

	public static getQuadkeysInBoundingBox(bounds: number[], zoom: number, tileSize=256): string[] {
		var keys: string[] = [];

		if (bounds != null && bounds.length >= 4) {
			var tl = this.positionToTileXY([bounds[0], bounds[3]], zoom, tileSize);
			var br = this.positionToTileXY([bounds[2], bounds[1]], zoom, tileSize);

			for (var x = tl.tileX; x <= br.tileX; x++) {
				for (var y = tl.tileY; y <= br.tileY; y++) {
					keys.push(this.tileXYToQuadKey(x, y, zoom));
				}
			}
		}

		return keys;
	}

	public static tileXYToBoundingBox(tileX: number, tileY: number, zoom: number, tileSize=256): [number, number, number, number] {
		//Top left corner pixel coordinates
		var x1 = tileX * tileSize;
		var y1 = tileY * tileSize;

		//Bottom right corner pixel coordinates
		var x2 = x1 + tileSize;
		var y2 = y1 + tileSize;

		var nw = this.worldPixelToPosition([x1, y1], zoom, tileSize);
		var se = this.worldPixelToPosition([x2, y2], zoom, tileSize);

		return [nw[0], se[1], se[0], nw[1]];
	}

	public static getCenterCoordsOfTile(tileX: number, tileY: number, zoom: number, tileSize=256): [number, number] {
		const xCenter = tileX * tileSize + 0.5 * tileSize;
		const yCenter = tileY * tileSize + 0.5 * tileSize;
		return this.worldPixelToPosition([xCenter, yCenter], zoom, tileSize);
	}

	/**
	 * Calculates the best map view (center, zoom) for a bounding box on a map.
	 * @param bounds A bounding box defined as an array of numbers in the format of [west, south, east, north].
	 * @param mapWidth Map width in pixels.
	 * @param mapHeight Map height in pixels.
	 * @param padding Width in pixels to use to create a buffer around the map. This is to keep markers from being cut off on the edge.
	 * @param tileSize The size of the tiles in the tile pyramid.
	 * @returns The center and zoom level to best position the map view over the provided bounding box.
	 */
	public static BestMapView(bounds: number[], mapWidth: number, mapHeight: number, padding: number, tileSize=256): { center: number[], zoom: number } {
		if (bounds == null || bounds.length < 4) {
			return {
				center: [0, 0],
				zoom: 1
			};
		}

		var boundsDeltaX: number;
		var centerLat: number;
		var centerLon: number;

		//Check if east value is greater than west value which would indicate that bounding box crosses the antimeridian.
		if (bounds[2] > bounds[0]) {
			boundsDeltaX = bounds[2] - bounds[0];
			centerLon = (bounds[2] + bounds[0]) / 2;
		}
		else {
			boundsDeltaX = 360 - (bounds[0] - bounds[2]);
			centerLon = ((bounds[2] + bounds[0]) / 2 + 360) % 360 - 180;
		}

		var ry1 = Math.log((Math.sin(bounds[1] * Math.PI / 180) + 1) / Math.cos(bounds[1] * Math.PI / 180));
		var ry2 = Math.log((Math.sin(bounds[3] * Math.PI / 180) + 1) / Math.cos(bounds[3] * Math.PI / 180));
		var ryc = (ry1 + ry2) / 2;

		centerLat = Math.atan(Math.sinh(ryc)) * 180 / Math.PI;

		var resolutionHorizontal = boundsDeltaX / (mapWidth - padding * 2);

		var vy0 = Math.log(Math.tan(Math.PI * (0.25 + centerLat / 360)));
		var vy1 = Math.log(Math.tan(Math.PI * (0.25 + bounds[3] / 360)));
		var zoomFactorPowered = (mapHeight * 0.5 - padding) / (40.7436654315252 * (vy1 - vy0));
		var resolutionVertical = 360.0 / (zoomFactorPowered * tileSize);

		var resolution = Math.max(resolutionHorizontal, resolutionVertical);

		var zoom = Math.log2(360 / (resolution * tileSize));

		return {
			center: [centerLon, centerLat],
			zoom: zoom
		};
	}
}