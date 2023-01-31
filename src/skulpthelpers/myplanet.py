from time import sleep, clock
from mercatorWorker import worldPixelToPosition, metersPerPixel

def _asyncWaitFor(signal):
  answer = waitFor(signal)
  while not answer:
    answer = waitFor(signal)
    sleep(0.002)
  return answer['payload']

globalChannelKeys = []

class Messenger:

	def waitForSignal(self, signal):
		return _asyncWaitFor(signal)

	def runCommand(self, command, value):
		signal = 'image'+command+str(round(clock()*1e6))
		show({'command': command, 'value': value, 'readysignal': signal})
		return self.waitForSignal(signal)

	def runCommandImmediate(self, command, value):
		signal = False
		show({'command': command, 'value': value, 'readysignal': signal})


class LocatedMessenger(Messenger):

	def getPosition(self, px, py):
		return worldPixelToPosition(self.worldCoords[0] + px, self.worldCoords[1] + py, self.zoomLevel)

	def metersPerPixel(self, px, py):
		return metersPerPixel(self.getPosition(px, py)[1], self.zoomLevel)

class Scene(LocatedMessenger):

	@classmethod
	def load(cls, src):
		scene = cls()
		payload = scene.runCommand('open', src)
		scene._afterOpening(payload)
		return scene

	@classmethod
	def fromCollectionFrame(cls, config):
		scene = cls()
		scene._afterOpening(config)
		return scene

	def _afterOpening(self, payload):
		global globalChannelKeys
		self.W = payload['W']
		self.H = payload['H']
		self.zoomLevel = payload['zoomLevel']
		self.worldCoords = payload['worldCoords']
		self.label = payload.get("label", "")
		self.sceneId = payload['sceneId']
		self.channels = payload['channels']
		self.channelkeys = [str(self.getId()) + "_" + c for c in self.channels]
		globalChannelKeys += self.channelkeys

	def _writePos(self, channel, pos, val):
		global writeShared
		global globalChannelKeys
		channelkey = str(self.getId()) + "_" + channel
		writeShared(channelkey, pos, val)
		return writeShared("dirtymarkers", globalChannelKeys.index(channelkey), 1)

	def _readPos(self, channel, pos):
		global readShared
		return readShared(str(self.getId()) + "_" + channel, pos)

	def addOverlay(self, label=""):
		overlay = Overlay()
		payload = overlay.runCommand('addOverlay', [self.getId(), label])
		overlay._afterOpening(payload)
		return overlay

	def forceChannel(self, channelname):
		self.runCommand('forceChannel', [self.getId(), channelname])

	def contains(self, x, y):
		return 0 <= x < self.W and 0 <= y < self.H

	def getId(self):
		return self.sceneId

	def getWidth(self):
		return self.W

	def getHeight(self):
		return self.H

	def getDimensions(self):
		return [self.W, self.H]

	def getPixel(self, x, y):
		return Pixel(self, x, y)

	def getPixels(self):
		for y in range(self.H):
			for x in range(self.W):
				yield Pixel(self, x, y)

	@property
	def pixels(self):
		return self.getPixels()

	def getPixelSize(self):
		return self.metersPerPixel(self.worldCoords[0] + 0.5*self.W, self.worldCoords[1] + 0.5*self.H)
	
	def setChannelAt(self, channel, x, y, val):
		if(not channel in self.channels):
			raise Exception("Channel not available: " + channel)
		pos = x + y * self.getWidth()
		return self._writePos(channel, pos, val)

	def getChannelAt(self, channel, x, y):
		if(not channel in self.channels):
			raise Exception("Channel not available: " + channel)
		pos = x + y * self.getWidth()
		return self._readPos(channel, pos)

class Overlay(Scene):
	def setChannelAt(self, channel, x, y, val):
		pos = x + y * self.getWidth()
		if self._readPos("a", pos) == 0:
			self._writePos("a", pos, 255)
		return self._writePos(channel, pos, val)

	def setColorAt(self, x, y, color):
		pos = x + y * self.getWidth()
		if self._readPos("a", pos) == 0:
			self._writePos("a", pos, 255)
		for channel in range(len(color)):
			writeShared(self.channelkeys[channel], pos, color[channel])
		return

	def addMarker(self, x, y):
		R = round(min(self.W, self.H) / 80)
		for dx in range(-2*R, 2*R+1):
			for dy in range(-2*R, 2*R+1):
				if self.contains(x + dx, y + dy):
					r = (dx**2 + dy**2)**0.5
					dr = abs(R-r)
					if dr < 0.3*R:
						self.setChannelAt("r", x + dx, y + dy, 255)
						alpha = 255
						if dr > 0.2 * R:
							alpha -= round(255 * (dr - 0.2*R) / (0.1*R))
						self.setChannelAt("a", x + dx, y + dy, alpha)

class Collection(LocatedMessenger):

	@classmethod
	def load(cls, url):
		collection = cls()
		payload = collection.runCommand('openCollection', url)
		collection._afterOpening(payload)
		return collection

	def _afterOpening(self, payload):
		global globalChannelKeys
		self.W = payload['W']
		self.H = payload['H']
		self.zoomLevel = payload['zoomLevel']
		self.worldCoords = payload['worldCoords']
		self.collectionId = payload['collectionId']
		self.scenes = []
		for index, sceneId in enumerate(payload['sceneIds']):
			scene = Scene.fromCollectionFrame({
				"W": payload["W"],
				"H": payload["H"],
				"worldCoords": payload['worldCoords'],
				"zoomLevel": payload['zoomLevel'],
				"sceneId": sceneId,
				"channels": payload["channels"][index],
				"label": payload["labels"][index]
			})
			scene.collectionId = self.collectionId
			self.scenes.append(scene)

	def addOverlay(self, label = ""):
		overlay = Overlay()
		payload = overlay.runCommand('addCollectionOverlay', [self.getId(), label])
		overlay._afterOpening(payload)
		overlay.collectionId = self.getId()
		return overlay

	def findSceneByLabel(self, label):
		for scene in self.scenes:
			if scene.label == label:
				return scene

	def forceFrame(self, sceneOrLabel):
		scene = sceneOrLabel if isinstance(sceneOrLabel, Scene) else self.findSceneByLabel(sceneOrLabel)
		self.runCommand('forceFrame', [self.getId(), self.scenes.index(scene)])

	def getId(self):
		return self.collectionId

	def getScenes(self):
		return self.scenes


class Pixel:
	def __init__(self, scene, x, y):
		self.scene = scene
		self.__x = x
		self.__y = y
		self.__p = x + y * scene.getWidth()
	
	@classmethod
	def create_channel_methods(cls):
		channelAliases = {
			"r": ["r", "R", "red", "rot"],
			"g": ["g", "G", "green", "gruen", "grün"],
			"b": ["b", "B", "blue", "blau"],
			"a": ["a", "A", "alpha", "alpha"],
			"elevation": ["h", "H", "elevation", "hoehe", "höhe"],
			"country": ["c", "C", "country", "land"],
			"pop": ["p", "P", "pop", "bev"],
			"nox": ["n", "N",  "nox", "NOx"],
			"night": ["l", "L", "night", "nacht", "light", "nightlight", "licht"],
		}
		def createGetter(channel):
			return lambda self: self.getChannel(channel)
		def createSetter(channel):
			return lambda self, val: self.setChannel(channel, val)
		for name, aliases in channelAliases.items():
			for alias in set(aliases):
				setattr(cls, alias, property(createGetter(name), createSetter(name)))
	
	def __getx(self):
		return self.__x
	x = property(__getx)
	
	def __gety(self):
		return self.__y
	y = property(__gety)
	
	def setChannel(self, channel, value):
		return self.scene.setChannelAt(channel, self.x, self.y, value)

	def getChannel(self, channel):
		return self.scene.getChannelAt(channel, self.x, self.y)

	def getSizeInMeters(self):
		return self.scene.metersPerPixel(self.x, self.y)
	size = property(getSizeInMeters)
		
	def getAreaInKm2(self):
		return 0.000001 * self.size * self.size

	def countPeople(self):
		return (self.getChannel("pop") or 0) * self.getAreaInKm2()
	people = property(countPeople)

	def getBrightness(self):
		return (self.getChannel("r") + self.getChannel("g") + self.getChannel("b")) / 3
	brightness = property(getBrightness)

	#alias
	def set(self, channel, value):
		return self.scene.setChannelAt(channel, self.x, self.y, value)

	#alias
	def get(self, channel):
		return self.scene._readPos(channel, self.__p)

	def __str__(self):
		log = "Pixel(%d,%d): {" % (self.x, self.y)
		for channel in self.scene.channels:
			log += channel + ":" + str(self.getChannel(channel)) + "  "
		log += "}"
		return log
	
	def getNeighbours(self):
		def addPixelIfExists(list, x, y):
			if self.scene.contains(x, y):
				list.append(self.scene.getPixel(x, y)) 
		neighbors = []
		x = self.x
		y = self.y
		addPixelIfExists(neighbors, x, y-1)
		addPixelIfExists(neighbors, x, y+1)
		addPixelIfExists(neighbors, x-1, y)
		addPixelIfExists(neighbors, x+1, y)
		return neighbors

	#alias
	def getNeighbors(self):
		return self.getNeighbors()


Pixel.create_channel_methods()