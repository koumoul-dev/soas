# Semantic Open API Specification library
Holds utility functions to manipulate an API described with [OpenAPI 3.0 specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.0.md) and [semantically annotated](http://www.intelligence.tuc.gr/~petrakis/publications/SOAS4.pdf).

## How to use
```
npm install --save
```

```
import soasLoader from 'soas'
import apiDoc from 'path-to/my-api.json'

const soas = soasLoader(apiDoc)

const endPoints = soas.endPoints()
const operations = soas.operations()
...
```
