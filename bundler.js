const fs = require('fs')
const path = require('path')
const babylon = require('babylon')
const traverse = require('babel-traverse').default
const babel = require('babel-core')

// 这里的ID是模块的名称(例如：AYh7或者1,2,3...)
let ID = 0

function createAsset(fileName) {
  const content = fs.readFileSync(fileName, 'utf-8')
  const ast = babylon.parse(content, {
    sourceType: 'module'
  })
  const dependencies = []
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      dependencies.push(node.source.value)
    }
  })

  const id = ID++

  const {code} = babel.transformFromAst(ast,null,{
    presets:['env']
  })

  return {
    id,
    fileName,
    dependencies,
    code,
  }
}

function createGraph(entry){
  const mainAsset = createAsset(entry)
  const queue = [mainAsset]

  for(const asset of queue){
    const dirname = path.dirname(asset.fileName)

    asset.mapping = {}

    asset.dependencies.forEach(relativePath=>{
      const absolutePath = path.join(dirname,relativePath)
      const child = createAsset(absolutePath)
      asset.mapping[relativePath] = child.id
      queue.push(child)
    })
  }
  return queue
}

function bundle(graph){
  let modules = ''

  graph.forEach(mod=>{
    modules += `${mod.id}:[
      function(require,module,exports){
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)}
    ],`
  })
  const result = `
    (function(modules){
      function require(id){
        const [fn,mapping] = modules[id]

        function loadRequire(relativePath){
          return require(mapping[relativePath])
        }

        const module = {exports:{}}

        fn(loadRequire, module,module.exports)

        return module.exports
      }
      require(0)
    })({${modules}})
  `
  return result
}
const graph = createGraph('./example/entry.js')
const result = bundle(graph)
console.log(result)