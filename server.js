const express = require('express')
const path = require('path')
const planetRoute = require('./route/planet.js')

const app = express()
const port = 3000

app.use('/planet', planetRoute)
app.use(express.static(path.join(__dirname, 'public')))
//app.get('/', (req, res) => res.send('Hello World!'))

app.listen(port, () => console.log(`Server listening on port ${port}.`))
