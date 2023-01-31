//mimics this library: https://github.com/boppreh/keyboard
export const keyboardLib = {
  "src/lib/keyboard.py": `
def isPressed(key):
  return key in getworkerstate('pressed_keys')
def is_pressed(key):
  return key in getworkerstate('pressed_keys')
def getPressedKeys():
  return getworkerstate('pressed_keys')
`
};