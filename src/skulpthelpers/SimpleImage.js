export const simpleImageLib = {
  "src/lib/simpleimage.py": `
from time import sleep, clock
import threading

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

def waitForImages():
    sleep(0.2)
    for img in images:
        img.sendPendingPixels()
        sleep(0.5)

class Pixel:
    def __init__(self, img, x, y):
        self.img = img
        self.__x = x
        self.__y = y
        self.__p = 4 * x + 4 * y * img.getWidth()
    def __getx(self):
        return self.__x
    x = property(__getx)
    def __gety(self):
        return self.__y
    y = property(__gety)
    def __getred(self):
        return self.img.getDataAtPos(self.__p)
    def __setred(self, val):
        return self.img.setDataAtPos(self.__p, val)
    red = property(__getred, __setred)
    def __getGreen(self):
        return self.img.getDataAtPos(self.__p + 1)
    def __setGreen(self, val):
        return self.img.setDataAtPos(self.__p + 1, val)
    green = property(__getGreen, __setGreen)
    def __getBlue(self):
        return self.img.getDataAtPos(self.__p + 2)
    def __setBlue(self, val):
        return self.img.setDataAtPos(self.__p + 2, val)
    blue = property(__getBlue, __setBlue)
    def __getAlpha(self):
        return self.img.getDataAtPos(self.__p + 3)
    def __setAlpha(self, val):
        return self.img.setDataAtPos(self.__p + 3, val)
    alpha = property(__getAlpha, __setAlpha)
    def __str__(self):
        return "Pixel(%d,%d): {red: %d, green: %d, blue: %d, alpha: %d}"%(self.x, self.y, self.red, self.green, self.blue, self.alpha)
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


def update(image):
    image.sendPendingPixels()
    threading.wait(50)
    update(image)

class Image:
    def __init__(self, srcOrW, H=7, color=None):
        global id
        global images
        images.append(self)
        self.id = id
        id = id + 1
        if isinstance(srcOrW, str):
            self.open(srcOrW)
        elif isinstance(srcOrW, int) and isinstance(H, int):
            self.create(srcOrW, H, color)
        else:
            print('Bitte Bildquelle oder Bildgrösse angeben.')
        self.pending = []
        self.operations = 0
        # memoize pixels: self.pixels = {}
        a = threading.add(update, self)
    @classmethod
    def open(cls, url):
        return cls(url)
    @classmethod
    def new(cls, W, H, color=None):
        return cls(W, H, color)
    def getId(self):
        return self.id
    def imageWaitFor(self, signal):
        answer = waitfor(signal)
        while not answer:
            answer = waitfor(signal)
            sleep(0.001)
        return answer['payload']
    def sendPendingPixels(self):
        if len(self.pending) > 0:
            self.runCommandImmediate('putPixelsChannel', self.pending)
            self.pending = []
    def runCommand(self, command, value):
        signal = 'image'+command+str(round(clock()*1e6))
        show({'command': command, 'value': value, 'readysignal': signal, 'id': self.id})
        return self.imageWaitFor(signal)
    def runCommandImmediate(self, command, value):
        signal = False
        show({'command': command, 'value': value, 'readysignal': signal, 'id': self.id})
    def open(self, src):
        payload = self.runCommand('open', src)
        self.W = payload['W']
        self.H = payload['H']
        self.data = payload['data']
    def create(self, W, H, color):
        if color == None:
            color = [200,200,240]
        payload = self.runCommand('create', [W, H, color])
        self.W = payload['W']
        self.H = payload['H']
        self.data = payload['data']
    def getWidth(self):
        return self.W
    def getHeight(self):
        return self.H
    def getDimensions(self):
        return [self.W, self.H]
    def getPixel(self, x, y):
        self.operations += 1
        # memoize pixels: if not ((x,y) in self.pixels):
        # memoize pixels:     self.pixels[(x, y)] = Pixel(self, x, y)
        # memoize pixels: return self.pixels[(x, y)]
        return Pixel(self, x, y)
    def getDataAtPos(self, pos):
        self.operations += 1
        return self.data[pos]
    def setDataAtPos(self, pos, val):
        self.operations += 1
        self.data[pos] = val
        self.pending.append([pos, val])
        if self.operations > 3000:
            threading.wait(0)
            self.operations = 0
        #self.runCommandImmediate('putPixelChannel', [pos, val])
    def setChannelAt(self, x, y, channel, val):
        pos = 4 * x + 4 * y * self.getWidth() + channel
        self.setDataAtPos(self, pos, val)
    def setColorAt(self, x, y, color):
        pos = 4 * x + 4 * y * self.getWidth()
        self.operations += 4
        for channel in range(4):
            value = 255
            if len(color) > channel:
                value = color[channel] 
            self.data[pos+channel] = value
            self.pending.append([pos+channel, value])
        if self.operations > 3000:
            threading.wait(0)
            self.operations = 0
    def getColorAt(self, x, y):
        pos = 4 * x + 4 * y * self.getWidth()
        return [self.data[pos], self.data[pos+1], self.data[pos+2], self.data[pos+3]]  
`
  ,

  // "src/lib/testjsmodule.js": `
  //     $builtinmodule = function (name) {
  //       var mod = {};
  //       var image = function ($gbl, $loc) {
  //         initializeImage = function (self) {
  //           self.delay = 0;
  //         };
  //
  //
  //         $loc.__init__ = new Sk.builtin.func(function (self, imageId) {
  //           console.log()
  //         })
  //
  //       };
  //
  //       mod.Image = Sk.misceval.buildClass(mod, image, "Image", []);
  //       return mod;
  //     }
  //   `,
  //
  // "src/lib/myturtle.js": `
  // var $builtinmodule = function (name) {
  //     var module = {};
  //     module.forward = new Sk.builtin.func(function (steps) {
  //         Sk.builtin.pyCheckArgsLen("forward", arguments.length, 1, 1);
  //         Sk.builtin.pyCheckType("steps", "number", Sk.builtin.checkNumber(steps));
  //         let st = Sk.ffi.remapToJs(steps);
  //         console.log(st, show);
  //         // let dirobj = "";
  //         // let arr = dirobj[p] || dirobj["./"+p] || dirobj["."+p] || "";
  //         // return Sk.ffi.remapToPy(arr);
  //     });
  //     return module;
  //   }
  //   `
};