import {readFileSync, writeFileSync} from "fs"

const libraries = {}

function parse(lib) {
	const text = readFileSync(`./${lib}`, "utf8").replaceAll(/(\r?\n)+/g, "\n")
	libraries[lib.slice(0, lib.indexOf("."))] = text
}

const libs = [
	"SimpleImage.js",
	"myplanet.js",
]

libs.forEach(parse)

writeFileSync("libraries.json", JSON.stringify(libraries, null, 2))