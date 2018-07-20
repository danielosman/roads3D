import { join } from 'path'

export default {
  entry: {
    'bundle': join(__dirname, 'src', 'index.js')
  },
  output: {
    path: join(__dirname, 'public'),
    filename: '[name].js'
  },
  devtool: 'source-map',
  mode: 'development'
}
