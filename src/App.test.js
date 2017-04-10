import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

import {
  getMaxEndForTolerance,
  getMinStartForTolerance,
  isPotentialConflictBefore,
  isPotentialConflictAfter
} from './timeline'

it('can generate the proper max end', ()=>{
  const maxEnd = getMaxEndForTolerance(1000, {rawStartTime: 5000, rawDuration: 2000})
  expect(maxEnd).toEqual(8000);
})

it('can generate the proper min start', ()=>{
  const maxEnd = getMinStartForTolerance(1000, {rawStartTime: 5000, rawDuration: 2000})
  expect(maxEnd).toEqual(4000);
})

it('can generate the proper min start without negative values', ()=>{
  const maxEnd = getMinStartForTolerance(1000, {rawStartTime: 500, rawDuration: 2000})
  expect(maxEnd).toEqual(0);
})

describe('conflict finding', ()=>{
  const timelineTolerance = 1000
  const getMaxEnd = getMaxEndForTolerance.bind(undefined, timelineTolerance)
  const getMinStart = getMinStartForTolerance.bind(undefined, timelineTolerance)
  const timelineConfig = {
    getMinStart,
    getMaxEnd,
    timelineTolerance
  }

  it('can find a conflict before an item', ()=> {
    const constraintItem = {
      rawStartTime: 1000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 5000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictBefore(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(true);
  })

  it(`doesnt find false positives before`, ()=> {
    const constraintItem = {
      rawStartTime: 1000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 10000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictBefore(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(false);
  })

  it(`finds potential conflicts before on the limit`, ()=> {
    const constraintItem = {
      rawStartTime: 1000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 6000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictBefore(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(true);
  })

  it('can find a conflict after an item', ()=> {
    const constraintItem = {
      rawStartTime: 8000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 5000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictAfter(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(true);
  })

  it(`doesnt find false positives after`, ()=> {
    const constraintItem = {
      rawStartTime: 10000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 2000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictAfter(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(false);
  })

  it(`finds potential conflicts after on the limit`, ()=> {
    const constraintItem = {
      rawStartTime: 11000,
      rawDuration: 4000
    }
    const optimizedItem = {
      rawStartTime: 6000,
      rawDuration: 4000
    }
    const isPotentialConflict = isPotentialConflictAfter(timelineConfig, constraintItem, optimizedItem)
    expect(isPotentialConflict).toEqual(true);
  })
})
