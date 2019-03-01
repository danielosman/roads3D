import { join } from 'path'

export default {
  entry: {
    'planets': join(__dirname, 'src', 'index.js'),
    'roads': join(__dirname, 'src', 'roads.js')
  },
  output: {
    path: join(__dirname, 'public'),
    filename: '[name].js'
  },
  devtool: 'source-map',
  mode: 'development'
}
