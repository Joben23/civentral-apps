import type { FloodReferenceResult } from '@/src/types/drrmFloodReference';
import type { Position } from '@/src/types/drrmHazardMap';

export interface FloodCheckState {
  location: Position | null;
  result: FloodReferenceResult | null;
  error: string | null;
  loading: boolean;
}

export type FloodCheckAction =
  | { type: 'BEGIN_LOCATION_SELECTION' }
  | { type: 'LOCATION_SELECTED'; location: Position }
  | { type: 'CHECK_STARTED' }
  | { type: 'CHECK_SUCCEEDED'; result: FloodReferenceResult }
  | { type: 'CHECK_FAILED'; error: string }
  | { type: 'CLEAR' };

export const INITIAL_FLOOD_CHECK_STATE: FloodCheckState = {
  location: null,
  result: null,
  error: null,
  loading: false,
};

export function floodCheckReducer(state: FloodCheckState, action: FloodCheckAction): FloodCheckState {
  switch (action.type) {
    case 'BEGIN_LOCATION_SELECTION':
      return { ...state, result: null, error: null };
    case 'LOCATION_SELECTED':
      return { location: action.location, result: null, error: null, loading: false };
    case 'CHECK_STARTED':
      return { ...state, result: null, error: null, loading: true };
    case 'CHECK_SUCCEEDED':
      return { ...state, result: action.result, error: null, loading: false };
    case 'CHECK_FAILED':
      return { ...state, result: null, error: action.error, loading: false };
    case 'CLEAR':
      return INITIAL_FLOOD_CHECK_STATE;
  }
}
