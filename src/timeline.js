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

export function makeOptimizedTimelineItems({timelineDuration, timelineTolerance, durationTolerance, isDebug}, timelineItems){
  var solver = new kiwi.Solver();
  const optimizedItems = []

  const Var = kiwi.Variable

  for (var i = 0; i < timelineItems.length; i++) {
    const item = timelineItems[i]

    const optimizedItem = {
      id: i,
      startTime: new Var(),
      endTime: new Var(),
      hue: item.hue,
      priority: 100-item.priority
    }

    //set duration
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime.minus(optimizedItem.startTime), kiwi.Operator.Ge, item.duration-durationTolerance, kiwi.Strength.required));
    //set tolerance
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Le, item.startTime+timelineTolerance, kiwi.Strength.required));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, item.startTime-timelineTolerance, kiwi.Strength.required));

    //suggest values
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Eq, item.startTime, optimizedItem.priority));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime, kiwi.Operator.Eq, item.startTime+item.duration, optimizedItem.priority));

    //setup outer limits
    solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, 0));
    solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime, kiwi.Operator.Le, timelineDuration));

    optimizedItems.push(optimizedItem)
  }

  solver.updateVariables();

  const constraintMap = {}

  isDebug && console.time('adding constraints')
  //after creating optimized items, set interitem constraints
  for (var j = 0; j < optimizedItems.length; j++) {
    const optimizedItem = optimizedItems[j]

    for (var k = 0; k < optimizedItems.length; k++) {
      //don't need to add a constraint if is self or the reverse constraint has already been added
      if (k === j || constraintMap[`${k}:${j}`]) continue
      constraintMap[`${j}:${k}`] = true

      const constraintItem = optimizedItems[k]

      if (constraintItem.endTime.value() < optimizedItem.startTime.value() || constraintItem.startTime.value() > optimizedItem.endTime.value()){
        continue
      }

      //prevent conflicts with earlier component endings
      if (constraintItem.startTime.value() <= optimizedItem.startTime.value() && constraintItem.endTime.value() < optimizedItem.endTime.value()){
        solver.addConstraint(new kiwi.Constraint(optimizedItem.startTime, kiwi.Operator.Ge, constraintItem.endTime.plus(1), optimizedItem.priority));
      }

      //prevent conflicts with later component starts
      if (constraintItem.startTime.value() >= optimizedItem.startTime.value()){
        solver.addConstraint(new kiwi.Constraint(optimizedItem.endTime.plus(1), kiwi.Operator.Le, constraintItem.startTime, optimizedItem.priority));
      }

      solver.updateVariables()
    }
  }

  isDebug && console.timeEnd('adding constraints')

  isDebug && console.log(`finished with ${Object.keys(constraintMap).length} constraints`)

  // Solve the constraints
  isDebug && console.time('resolve')
  solver.updateVariables();
  isDebug && console.timeEnd('resolve')
  return optimizedItems
}
