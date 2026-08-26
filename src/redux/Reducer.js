import {
  TIFFIN_REQUEST,
  TIFFIN_SUCCESS,
  TIFFIN_FAILURE,
} from './Constant';

const initialState = {
  tiffins: [],
  loading: false,
  error: null,
};

const tiffinReducer = (
  state = initialState,
  action,
) => {
  switch (action.type) {
    case TIFFIN_REQUEST:
      return {
        ...state,

        loading: true,

        error: null,
      };

    case TIFFIN_SUCCESS:
      return {
        ...state,

        loading: false,

        tiffins:
          Array.isArray(
            action.payload,
          )
            ? action.payload
            : [],

        error: null,
      };

    case TIFFIN_FAILURE:
      return {
        ...state,

        loading: false,

        error:
          action.payload ||
          'Unable to load tiffins.',
      };

    default:
      return state;
  }
};

export default tiffinReducer;