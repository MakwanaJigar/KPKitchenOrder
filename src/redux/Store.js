import {
  legacy_createStore as createStore,
  applyMiddleware,
  combineReducers,
} from 'redux';

import {thunk} from 'redux-thunk';

import tiffinReducer from './Reducer';

const rootReducer = combineReducers({
  tiffin: tiffinReducer,
});

const store = createStore(
  rootReducer,
  applyMiddleware(thunk),
);

export default store;