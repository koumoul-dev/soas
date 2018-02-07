# Semantic Open API Specification library
Holds utility functions to manipulate an API described with [OpenAPI 3.0 specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md) and [semantically annotated](http://www.intelligence.tuc.gr/~petrakis/publications/SOAS4.pdf).

## Quick start
```
npm install --save
```

```javascript
import soasLoader from 'soas'
import apiDoc from 'path-to/my-api.json'

const soas = soasLoader(apiDoc)

const endPoints = soas.endPoints()
const actions = soas.actions()

const input1 = {
  "http://schema.org/streetAddress": "7 Rue Victor Schoelcher",
  "http://rdf.insee.fr/def/geo#codeCommune":"22050"
}
const output1 = await soas.execute('getCoord', input1)
// output1 is :
// {"http://schema.org/identifier":"1",
// "http://schema.org/latitude":"48.3",
// "http://schema.org/longitude":"-3.4"}

// works with streams too
const input2 = fs.createReadStream(path.join(__dirname, 'addresses.ndjson'))
                  .pipe(mimeTypeStream('application/x-ndjson').parser())
const output2 = await soas.execute('postCoords', input)
output2.pipe(mimeTypeStream('application/x-ndjson').serializer()).pipe(process.stdout)
...
```
## Documentation

### Constructor
See the [OpenAPI 3.0 specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md) for the correct format of the API description.

```javascript
import soasLoader from 'soas'
import apiDoc from 'path-to/my-api.json'

// apiDoc is a JSON describing an API with the OpenApi 3.0 specification
// To keep this library light, schema validation is not handled
const soas = soasLoader(apiDoc)
```

### endPoints()
List API endpoints. Return an array of objects with the following properties :
 * **method** : the HTTP method
 * **path** : the path this endpoint refers to
 * **operation** : the operation described by this endpoint. See the [Operation Object](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#operationObject)

### actions()
List all actions. An action is an API endpoint semantized with [annotations described here](http://www.intelligence.tuc.gr/~petrakis/publications/SOAS4.pdf). It has the followings properties :
 * **id** : the identifier of the action
 * **type** : the type of action. This should be a subtype of [schema.org Action](http://schema.org/Action), or something similar.
 * **operation** : path and method
 * **input** : an map of concepts => parameters location
 * **inputCollection** : boolean indicating if the action takes a collection as input
 * **inputBodyTypes** : the possible mime-types for the request body, if there is one
 * **output** : an map of concepts => object fields
 * **outputSchema**: The JSON schema of output
 * **outputCollection** : boolean indicating if the action outputs a collection
 * **outputBodyTypes** : the possible mime-types for the response body, if there is one
 * **summary** : the summary of the operation this action refers to
 * **canUse** : a boolean indicating if this library is able to use the action or not

### execute(actionId [, input, server])
Return a promise. Once resolved, can be an object or a stream of objects which are maps of concepts and their value.

**actionId** is the id of an action listed with `actions()`. **input** is is a map of concepts and their value. It can be a stream of objects too. **server** is an url to query, if not provided it will be resolved to the url of the first [Server Object](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md#serverObject) of the `servers` property of the API description.
