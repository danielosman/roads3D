const express = require('express')
const path = require('path')
const planetRoute = require('./route/planet.js')

const app = express()
const port = 4000

app.use('/planet', planetRoute)
app.use(express.static(path.join(__dirname, 'public')))

app.listen(port, () => console.log(`Server listening on port ${port}.`))
