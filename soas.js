const axios = require('axios')
const Transform = require('stream').Transform
const mimeTypeStream = require('mime-type-stream')

module.exports = function(jsonApi) {
  this.api = jsonApi

  this.endPoints = [].concat(...Object.keys(this.api.paths).map(path => Object.keys(this.api.paths[path]).map(method => ({
    method: method,
    path: path,
    operation: this.api.paths[path][method]
  }))))

  let actions = this.endPoints.filter(endPoint => endPoint.operation['x-operationType']).map(endPoint => {
    const operation = endPoint.operation
    const input = {}
    const output = {}
    operation.parameters = operation.parameters || [] // On 2 lines for linter ...
    operation.parameters.filter(p => p['x-refersTo']).forEach(p => {
      input[p['x-refersTo']] = {
        name: p.name,
        description: p.description,
        in: p.in,
        required: p.required
      }
    })
    let canUse = true
    let inputCollection = false
    let inputBodyTypes
    if (operation.requestBody) {
      const content = operation.requestBody.content
      inputBodyTypes = Object.keys(content).sort().reverse() // csv, ndjson, json priority order
      if (content && content['application/json'] && content['application/json'].schema) {
        // We will include a test on content['application/json'].schema['x-collectionOn'] later.
        // For now we only handle collections in arrays
        let properties
        if (content['application/json'].schema.type === 'array') {
          inputCollection = true
          properties = content['application/json'].schema.items.properties
        } else {
          properties = content['application/json'].schema.properties
        }
        Object.keys(properties).filter(p => properties[p]['x-refersTo']).forEach(p => {
          const prop = properties[p]
          input[prop['x-refersTo']] = {
            name: p, // path in object, for the moment we only handle 1 level
            description: prop.description,
            in: 'body',
            required: operation.requestBody.required && prop.required
          }
        })
      } else if (operation.requestBody.required) {
        // The body is required but we don't know how to fill it
        canUse = false
      }
    }
    let outputCollection = false
    let outputBodyTypes
    // We will handle other codes later
    if (operation.responses[200]) {
      const content = operation.responses[200].content
      outputBodyTypes = Object.keys(content).sort().reverse() // csv, ndjson, json priority order
      if (content && content['application/json'] && content['application/json'].schema) {
        // We will include a test on content['application/json'].schema['x-collectionOn'] later.
        // For now we only handle collections in arrays
        let properties
        if (content['application/json'].schema.type === 'array') {
          outputCollection = true
          properties = content['application/json'].schema.items.properties
        } else {
          properties = content['application/json'].schema.properties
        }
        Object.keys(properties).filter(p => properties[p]['x-refersTo']).forEach(p => {
          const prop = properties[p]
          output[prop['x-refersTo']] = {
            name: p, // path in object, for the moment we only handle 1 level
            description: prop.description,
            required: prop.required
          }
        })
      }
    }
    return {
      id: operation.operationId || (endPoint.method + endPoint.path),
      operation: {
        path: endPoint.path,
        method: endPoint.method
      },
      input,
      inputCollection,
      inputBodyTypes,
      output,
      outputCollection,
      outputBodyTypes,
      summary: operation.summary,
      type: operation['x-operationType'],
      canUse
    }
  })

  this.actions = Object.assign({}, ...actions.map(a => ({
    [a.id]: a
  })))

  return {
    endPoints: () => this.endPoints,
    actions: () => Object.values(this.actions),
    // Execute an action, input and server are optional
    // If the selected action has inputCollection set to true, then input must be a stream of JSON objects
    // If the selected action has outputCollection set to true, then output will be a stream of JSON objects
    execute: (actionId, input, server) => {
      // Input transform logic : we transform a map of concepts and value to a JSON object
      // that have the required format according to the body schema
      const concepts = Object.assign({}, ...Object.keys(this.actions[actionId].input).map(conceptId => ({
        [conceptId]: this.actions[actionId].input[conceptId]
      })))
      const transformInput = (item) => {
        return Object.assign({}, ...Object.keys(item).filter(k => concepts[k] && concepts[k].in === 'body').map(k => ({
          [concepts[k].name]: item[k]
        })))
      }
      // Output transform logic : from a json object to a map of concepts with values
      const fields = Object.assign({}, ...Object.keys(this.actions[actionId].output).map(conceptId => ({
        [this.actions[actionId].output[conceptId].name]: conceptId
      })))
      const transformOutput = (item) => {
        return Object.assign({}, ...Object.keys(item).filter(k => fields[k]).map(k => ({
          [fields[k]]: item[k]
        })))
      }

      // Options of the HTTP request
      const options = {
        method: this.actions[actionId].operation.method,
        url: (server || this.api.servers[0].url) + this.actions[actionId].operation.path,
        responseType: this.actions[actionId].outputCollection ? 'stream' : 'json'
      }
      if (input) {
        if (this.actions[actionId].inputCollection) {
          // console.log(JSON.stringify(concepts, null, 2))
          const parametersStream = new Transform({
            objectMode: true,
            transform: (data, _, done) => {
              const transformed = transformInput(data)
              done(null, transformed)
            }
          })
          options.data = input.pipe(parametersStream).pipe(mimeTypeStream(this.actions[actionId].inputBodyTypes[0]).serializer())
        } else {
          options.data = JSON.stringify(transformInput(input))
        }
      }

      return axios(options)
        .then(response => {
          if (this.actions[actionId].outputCollection) {
            const conceptsStream = new Transform({
              objectMode: true,
              transform: (data, _, done) => {
                const transformed = transformOutput(data)
                done(null, transformed)
              }
            })
            return response.data.pipe(mimeTypeStream(this.actions[actionId].outputBodyTypes[0]).parser()).pipe(conceptsStream)
          } else {
            return transformOutput(response.data)
          }
        })
    }
  }
}
