from time import sleep, clock

"""
create a decorator to add functions as methods
with this decorators all functions are usable global
and as method

def add_method(cls):
	def decorator(func):
		def wrapper(self, *args, **kwargs):
			return func(*args, **kwargs)
		setattr(cls, func.__name__, wrapper)
		# Note we are not binding func, but wrapper which accepts self but does exactly the same as func
		return func # returning func means func can still be used normally
	return decorator
"""

id = 0
images = []

def _asyncWaitFor(signal):
  answer = waitFor(signal)
  while not answer:
    answer = waitFor(signal)
    sleep(0.002)
  return answer['payload']

def getCountry(long, lat):
  signal = 'getcountry'+str(round(clock()*1e6))
  show({'command': 'getCountry', 'value': [long, lat], 'readysignal': signal, 'id': 0})
  return _asyncWaitFor(signal)

class Image:
	def __init__(self, srcOrW, H=7, color=None):
		global id
		global images
		images.append(self)
		self.id = id
		id = id + 1
		if isinstance(srcOrW, str):
			self._open(srcOrW)
		elif isinstance(srcOrW, int) and isinstance(H, int):
			self._create(srcOrW, H, color)
		else:
			print('Bitte Bildquelle oder Bildgrösse angeben.')

	@classmethod
	def open(cls, url):
		return cls(url)

	@classmethod
	def create(cls, W, H, color):
		return cls(W, H, color)

	@classmethod
	def new(cls, W, H, color=None):
		return cls(W, H, color)

	def getId(self):
		return self.id

	def imageWaitFor(self, signal):
		return _asyncWaitFor(signal)

	def runCommand(self, command, value):
		signal = 'image'+command+str(round(clock()*1e6))
		show({'command': command, 'value': value, 'readysignal': signal, 'id': self.id})
		return self.imageWaitFor(signal)

	def runCommandImmediate(self, command, value):
		signal = False
		show({'command': command, 'value': value, 'readysignal': signal, 'id': self.id})

	def _open(self, src):
		payload = self.runCommand('open', src)
		self._afterOpening(payload)

	def _create(self, W, H, color):
		if color == None:
			color = [200,200,240]
		payload = self.runCommand('create', [W, H, color])
		self._afterOpening(payload)

	def _afterOpening(self, payload):
		self.W = payload['W']
		self.H = payload['H']
		self.channels = payload['channels']
		self.channelkeys = [str(self.getId()) + "_" + c for c in self.channels]

	def _writePos(self, channel, pos, val):
		return writeShared(str(self.getId()) + "_" + channel, pos, val)

	def _readPos(self, channel, pos):
		return readShared(str(self.getId()) + "_" + channel, pos)

	def getWidth(self):
		return self.W

	def getHeight(self):
		return self.H

	def getDimensions(self):
		return [self.W, self.H]

	def getPixel(self, x, y):
		return Pixel(self, x, y)

	def setChannelAt(self, channel, x, y, val):
		pos = x + y * self.getWidth()
		return self._writePos(channel, pos, val)

	def setColorAt(self, x, y, color):
		pos = x + y * self.getWidth()
		for channel in range(len(color)):
			writeShared(self.channelkeys[channel], pos, color[channel])
		return

	def getChannelAt(self, channel, x, y):
		pos = x + y * self.getWidth()
		return self._readPos(channel, pos)

	def getColorAt(self, x, y):
		pos = x + y * self.getWidth()
		return [readShared(channel, pos) for channel in self.channelkeys]

class Pixel:
	def __init__(self, img, x, y):
		self.img = img
		self.__x = x
		self.__y = y
		self.__p = x + y * img.getWidth()

	def __getx(self):
		return self.__x
	x = property(__getx)
	
	def __gety(self):
		return self.__y
	y = property(__gety)
	
	def setChannel(self, channel, value):
		return self.img.setChannel(channel, self.x, self.y, value)

	def getChannel(self, channel):
		return self.img.getChannelAt(channel, self.x, self.y)

	#alias
	def set(self, channel, value):
		return self.img.getChannelAt(channel, self.x, self.y)

	#alias
	def get(self, channel):
		return self.img._readPos(channel, self.__p)

	def __str__(self):
		log = "Pixel(%d,%d): {" % (self.x, self.y)
		for channel in self.img.channels:
			log += channel + ":" + str(self.getChannel(channel)) + "  "
		log += "}"
		return log
	
	def getNeighbors(self):
		neighbors = []
		x = self.x
		y = self.y
		H = self.img.getHeight()
		W = self.img.getWidth()
		if y > 0:
			neighbors.append(self.img.getPixel(x, y-1))
		if y < H-1:
			neighbors.append(self.img.getPixel(x, y+1))
		if x > 0:
			neighbors.append(self.img.getPixel(x-1, y))
		if x < W-1:
			neighbors.append(self.img.getPixel(x+1, y))
		return neighbors

	#alias
	def getNeighbours(self):
		return self.getNeighbors()
