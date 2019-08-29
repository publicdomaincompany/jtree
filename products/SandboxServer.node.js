"use strict"
//tooling product jtree.node.js
//tooling product jtree.browser.js
//tooling product commandLineApp.node.js
//tooling product treeBase.node.js
//tooling product SandboxServer.node.js
//tooling product core.test.browser.js
//tooling product abstractBuilder.node.js
//tooling product TreeComponentFramework.browser.js
//tooling product TreeComponentFramework.node.js
Object.defineProperty(exports, "__esModule", { value: true })
//tooling product SandboxServer.node.js
const express = require("express")
const { readFile } = require("fs")
const { TypeScriptRewriter } = require("../products/TypeScriptRewriter.js")
class SandboxServer {
  start(port) {
    const app = express()
    app.get("/*.js", (req, res) => {
      const filename = req.path.substr(1)
      readFile(__dirname + "/../" + filename, "utf8", (err, code) => {
        if (err) throw err
        res.send(
          new TypeScriptRewriter(code)
            .removeRequires()
            .removeHashBang()
            .removeNodeJsOnlyLines()
            .changeNodeExportsToWindowExports()
            .getString()
        )
      })
    })
    app.use(express.static(__dirname + "/../"))
    app.listen(port, () => {
      console.log(`Running sandbox. cmd+dblclick: http://localhost:${port}/sandbox`)
    })
  }
}

module.exports = { SandboxServer }