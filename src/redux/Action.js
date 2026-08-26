import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  TIFFIN_REQUEST,
  TIFFIN_SUCCESS,
  TIFFIN_FAILURE,
} from './Constant';

const API_URL =
  'https://replete-software.com/projects/kp_admin/api/customer/tiffins';

export const getTiffins = () => {
  return async dispatch => {
    dispatch({
      type: TIFFIN_REQUEST,
    });

    try {
      /*
       * User may be logged in OR guest.
       * Therefore token is optional.
       */

      const token = await AsyncStorage.getItem('token');

      console.log('======================================');
      console.log('TIFFIN API CALL');
      console.log('URL:', API_URL);
      console.log('TOKEN AVAILABLE:', !!token);
      console.log('======================================');

      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      /*
       * Only send Authorization if user is logged in.
       */
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(API_URL, {
        method: 'GET',
        headers,
      });

      console.log(
        'TIFFIN STATUS:',
        response.status,
      );

      const responseText =
        await response.text();

      console.log(
        'RAW TIFFIN RESPONSE:',
        responseText,
      );

      let result;

      try {
        result = JSON.parse(responseText);
      } catch (error) {
        throw new Error(
          'Server returned an invalid response.',
        );
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Unable to fetch tiffins. Status: ${response.status}`,
        );
      }

      let tiffins = [];

      /*
       * Direct array
       */
      if (Array.isArray(result)) {
        tiffins = result;
      }

      /*
       * {
       *   data: [...]
       * }
       */
      else if (
        Array.isArray(result?.data)
      ) {
        tiffins = result.data;
      }

      /*
       * {
       *   tiffins: [...]
       * }
       */
      else if (
        Array.isArray(result?.tiffins)
      ) {
        tiffins =
          result.tiffins;
      }

      /*
       * {
       *   data: {
       *      tiffins: [...]
       *   }
       * }
       */
      else if (
        Array.isArray(
          result?.data?.tiffins,
        )
      ) {
        tiffins =
          result.data.tiffins;
      }

      console.log(
        'FINAL TIFFINS:',
        tiffins,
      );

      console.log(
        'TOTAL TIFFINS:',
        tiffins.length,
      );

      dispatch({
        type: TIFFIN_SUCCESS,
        payload: tiffins,
      });

      return tiffins;
    } catch (error) {
      console.log(
        'TIFFIN API ERROR:',
        error,
      );

      dispatch({
        type: TIFFIN_FAILURE,

        payload:
          error?.message ||
          'Something went wrong while fetching tiffins.',
      });

      return [];
    }
  };
};