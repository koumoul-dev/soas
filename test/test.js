const test = require('ava')
const nock = require('nock')
const fs = require('fs')
const path = require('path')
const mimeTypeStream = require('mime-type-stream')
const soasLoader = require('..')
const apiDoc = require('./geocoder-api.json')

const soas = soasLoader(apiDoc)

test('List API endpoints', t => {
  const endPoints = soas.endPoints()
  t.is(endPoints.length, 4)
})

test('List Actions', t => {
  const actions = soas.actions()
  t.is(actions.length, 3)
})

nock('https://staging.koumoul.com/s/geocoder/api/v1')
  .post('/coords')
  .reply(200, function(uri, requestBody) {
    return fs.createReadStream(path.join(__dirname, 'coordinates.csv'))
  })

test.cb('Execute batch', t => {
  const input = fs.createReadStream(path.join(__dirname, 'addresses.ndjson')).pipe(mimeTypeStream('application/x-ndjson').parser())
  soas.execute('postCoords', input).then(output => {
    output.pipe(mimeTypeStream('application/x-ndjson').serializer()).pipe(process.stdout)
    output.on('end', () => {
      t.end()
    })
  })
})

nock('https://staging.koumoul.com/s/geocoder/api/v1')
  .get('/coord')
  .reply(200, function(uri, requestBody) {
    return fs.readFileSync(path.join(__dirname, 'coordinates.ndjson'), 'utf-8').split('\n').shift()
  })

test('Execute single', async t => {
  const input = fs.readFileSync(path.join(__dirname, 'addresses.ndjson'), 'utf-8').split('\n').shift()
  const output = await soas.execute('getCoord', JSON.parse(input))
  t.truthy(output['http://schema.org/latitude'])
  t.truthy(output['http://schema.org/longitude'])
})
