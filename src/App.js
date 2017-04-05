import React, { Component } from 'react';
import './App.css';
import kiwi from 'kiwi.js'

const timelineDuration = 10000
const componentDurationMultiplier = 300
const componentCount = 50

function makeRandomHue(){
  return Math.floor(Math.random() * 360)
}

function generateTestTimelineData(){
  const timelineData = []
  for (var i = 0; i < componentCount; i++) {
    const duration = Math.floor(Math.random() * 10 * componentDurationMultiplier) + 1000
    timelineData.push({
      startTime: Math.floor(Math.random() * 8000),
      duration,
      hue: makeRandomHue(),
      priority: Math.floor(Math.random() * 100)
    })
  }
  return timelineData.sort((a,b) => a.startTime - b.startTime)
}

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

function makeTimelineRows(timelineItems){
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

const timelineTolerance = 2000
const durationTolerance = 500

function makeOptimizedTimelineItems(timelineItems){
  var solver = new kiwi.Solver();
  const optimizedItems = []

  const Var = kiwi.Variable

  for (var i = 0; i < timelineItems.length; i++) {
    const item = timelineItems[i]

    const optimizedItem = {
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

  //after creating optimized items, set interitem constraints
  for (var j = 0; j < optimizedItems.length; j++) {
    const optimizedItem = optimizedItems[j]

    for (var k = 0; k < optimizedItems.length; k++) {
      if (k === j) continue
      const constraintItem = optimizedItems[k]

      //don't need to add a constraint if the reverse constraint has already been added
      if (constraintMap[`${k}:${j}`]) continue

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
      constraintMap[`${j}:${k}`] = true
    }
  }

  console.log(`finished with ${Object.keys(constraintMap).length} constraints`)

  // Solve the constraints
  console.time('resolve')
  solver.updateVariables();
  console.timeEnd('resolve')
  return optimizedItems
}

class App extends Component {
  render() {
    const timelineItems = generateTestTimelineData()
    const timelineInRows = makeTimelineRows(timelineItems)
    let optimizedTimelineItems
    try {
      optimizedTimelineItems = makeOptimizedTimelineItems(timelineItems)
    } catch(err){
      optimizedTimelineItems = []
      console.error('NOPE')
    }
    const optimizedTimelineRows = makeTimelineRows(optimizedTimelineItems)
    return (
      <div className="wrapper">
        <h1>naive</h1>
        <div className="timeline">
          {timelineInRows.map((rowItems, i) => {
            return <div key={i} style={{position:'relative', height: 10, top: 2}}>
                    {rowItems.map((item, i) => {
                      return <div key={`naive-${i}`} className="timelineItem" style={{background: `hsla(${item.hue}, 100%, 50%, .${item.priority})`, left: `${(getValue(item.startTime) / timelineDuration)*100}%`, width: `${(getValue(item.duration) / timelineDuration)*100}%`}}></div>
                    })}
                   </div>
          })}
        </div>
        <h1>optimized</h1>
        <div className="timeline">
          {optimizedTimelineRows.map((rowItems, i) => {
            return <div key={i} style={{position:'relative', height: 10, top: 2}}>
                    {rowItems.map((item, i) => {
                      return <div key={`opt-${i}`} className="timelineItem" style={{background: `hsla(${item.hue}, 100%, 50%, .${100-item.priority})`, left: `${(getValue(item.startTime) / timelineDuration)*100}%`, width: `${((getValue(item.endTime)-getValue(item.startTime)) / timelineDuration)*100}%`}}></div>
                    })}
                   </div>
          })}
        </div>
      </div>
    );
  }
}

export default App;
