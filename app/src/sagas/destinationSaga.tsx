import { put, call } from 'redux-saga/effects';

import axios from './../utils/axious';
import * as destinationAction from '../actions/destinations';
import { IFlightsRequestAction } from '../models/request/flightDestinationRequest';

export function* fetchDestinationsSaga(action: IFlightsRequestAction) {
    //console.log("fetchDestinationsSaga");
    //console.log(action.model);
    try {
        const response = yield call(
            axios.get,
            '/api/v1/flights/GetDestinationPrice'
        );

        yield put(destinationAction.fetchDestinationsSuccess(response.data));
    } catch (error) {
        yield put(destinationAction.fetchDestinationsFail(error.message));
    }
}
