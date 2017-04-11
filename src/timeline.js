import kiwi from 'kiwi.js'

function getValue(val){
  return typeof val === 'object' ? val.value() : val
}

function addItemToRow(item, row){
  if (row.length !== 0){
    const lastItem = row[row.length-1]
    if (lastItem.endTime && getValue(lastItem.startTime)+(getValue(lastItem.endTime)-getValue(lastItem.startTime)) >= getValue(item.startTime)) return false
    if (getValue(lastItem.startTime)+getValue(lastItem.duration) >= getValue(item.startTime)) return false
  }
  row.push(item)
  return true
}

export function makeTimelineRowsImproved(timelineItems){
  const rows = []
  for (var i = 0; i < timelineItems.length; i++) {
    const timelineItem = timelineItems[i]
    let hasAddedItem = false
    for (var j = 0; j < rows.length; j++) {
      const row = rows[j]
      if (row.length !== 0){
        const previousItem = row.slice().reverse().find(item => getValue(item.startTime) <= getValue(timelineItem.startTime))
        if (previousItem && getValue(previousItem.endTime) >= getValue(timelineItem.startTime)) continue
        const nextItem = row.find(item => getValue(item.startTime) >= getValue(timelineItem.startTime))
        if (nextItem && timelineItem.endTime && getValue(nextItem.startTime) <= getValue(timelineItem.endTime)) continue
      }
      hasAddedItem = true
      row.push(timelineItem)
      row.sort((a,b) => getValue(a.startTime) - getValue(b.startTime))
      break
    }
    if (!hasAddedItem){
      rows.push([timelineItem])
    }
  }
  return rows
}

export function makeTimelineRows(timelineItems){
  const rows = []
  timelineItems.forEach(item => {
    let hasAddedItem = false
    for (var i = 0; i < rows.length; i++) {
      if (addItemToRow(item, rows[i])){
        hasAddedItem = true
        break
      }
    }
    if (!hasAddedItem){
      const newRow = []
      rows.push(newRow)
      addItemToRow(item, newRow)
    }
  })
  return rows
}

export function getMaxEndForTolerance(timelineTolerance, {rawStartTime, rawDuration}){
  return rawStartTime + rawDuration + timelineTolerance
}

export function getMinStartForTolerance(timelineTolerance, {rawStartTime}){
  return Math.max(0, rawStartTime - timelineTolerance)
}

function findCloseItems(timelineOptions, optimizedItem){
  return constraintItem => {
    return isPotentialConflictBefore(timelineOptions, constraintItem, optimizedItem) ||
           isPotentialConflictAfter(timelineOptions, constraintItem, optimizedItem)
  }
}

export function isPotentialConflictBefore({getMaxEnd, getMinStart}, constraintItem, optimizedItem){
  return constraintItem.rawStartTime <= optimizedItem.rawStartTime && getMaxEnd(constraintItem) >= getMinStart(optimizedItem)
}

export function isPotentialConflictAfter({getMaxEnd, getMinStart}, constraintItem, optimizedItem){
  return getMaxEnd(constraintItem) >= optimizedItem.rawStartTime+optimizedItem.rawDuration && getMinStart(constraintItem) <= getMaxEnd(optimizedItem)
}

export function makeOptimizedTimelineItems({timelineDuration, timelineTolerance, durationTolerance, isDebug}, timelineItems){
  var solver = new kiwi.Solver();

  const optimizedItems = []

  const Var = kiwi.Variable
  const itemsByPriority = timelineItems.slice().sort((a,b) => a.priority - b.priority)

  for (var i = 0; i < itemsByPriority.length; i++) {
    const item = itemsByPriority[i]

    const optimizedItem = {
      id: i+1,
      rawStartTime: item.startTime, //used to calculate potential conflicts
      rawDuration: item.duration, //same
      startTime: new Var(),
      endTime: new Var(),
      hue: item.hue,
      priority: item.priority,
      cassowaryPriority: i+1 //already sorted by priority, this guarantees uniqueness
    }

    //set duration
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime.minus(optimizedItem.startTime), kiwi.Operator.Ge, item.duration-durationTolerance, kiwi.Strength.required));

    //set tolerance
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Le, item.startTime+timelineTolerance, kiwi.Strength.required));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, item.startTime-timelineTolerance, kiwi.Strength.required));

    //suggest values
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Eq, item.startTime, kiwi.Strength.strong));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime, kiwi.Operator.Eq, item.startTime+item.duration, kiwi.Strength.strong));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime.minus(optimizedItem.startTime), kiwi.Operator.Eq, item.duration, kiwi.Strength.strong));

    //setup outer limits
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, 0));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime, kiwi.Operator.Le, timelineDuration));

    optimizedItems.push(optimizedItem)
  }

  solver.updateVariables();

  const constraintMap = {}
  const constraintDebugMap = {}
  let constraintCount = 0

  //setup limit functions with tolerances
  const getMaxEnd = getMaxEndForTolerance.bind(undefined, timelineTolerance)
  const getMinStart = getMinStartForTolerance.bind(undefined, timelineTolerance)

  const timelineConfig = {getMaxEnd, getMinStart, timelineTolerance}

  isDebug && console.time('adding constraints')
  //after creating optimized items, set interitem constraints
  for (var j = 0; j < optimizedItems.length; j++) {
    const optimizedItem = optimizedItems[j]

    const constraintItems = optimizedItems.filter(findCloseItems(timelineConfig, optimizedItem))

    for (var k = 0; k < constraintItems.length; k++) {
      const constraintItem = constraintItems[k]
      //don't need to add a constraint if is self or the reverse constraint has already been added
      if (k === j || constraintMap[`${constraintItem.id}:${optimizedItem.id}`]) continue
      constraintMap[`${optimizedItem.id}:${constraintItem.id}`] = true

      let hasAddedConstraint = false

      if (!constraintDebugMap[`constraints-${optimizedItem.id}`]){
        constraintDebugMap[`constraints-${optimizedItem.id}`] = []
      }
      if (!constraintDebugMap[`constraints-${constraintItem.id}`]){
        constraintDebugMap[`constraints-${constraintItem.id}`] = []
      }

      //prevent conflicts with earlier component endings
      if (isPotentialConflictBefore(timelineConfig, constraintItem, optimizedItem)){
        hasAddedConstraint = true
        constraintCount++
        solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, constraintItem.endTime.plus(1), kiwi.Strength.strong));
      }

      //prevent conflicts with later component starts
      if (isPotentialConflictAfter(timelineConfig, constraintItem, optimizedItem)){
        hasAddedConstraint = true
        constraintCount++
        solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime.plus(1), kiwi.Operator.Le, constraintItem.startTime, kiwi.Strength.strong));
      }

      if (hasAddedConstraint){
        constraintDebugMap[`constraints-${optimizedItem.id}`].push(constraintItem.id)
        constraintDebugMap[`constraints-${constraintItem.id}`].push(optimizedItem.id)
      }

      solver.updateVariables()
    }
  }

  isDebug && console.timeEnd('adding constraints')

  isDebug && console.log(`finished with ${constraintCount} constraints`)

  // Solve the constraints
  isDebug && console.time('resolve')
  solver.updateVariables();
  isDebug && console.timeEnd('resolve')
  return {optimizedItems, constraintDebugMap}
}
