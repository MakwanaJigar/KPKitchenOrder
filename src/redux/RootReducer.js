import {combineReducers} from 'redux';
import tiffinReducer from './Reducer';

const rootReducer = combineReducers({
  tiffin: tiffinReducer,
});

export default rootReducer;