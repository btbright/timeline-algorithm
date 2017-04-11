import React, { Component } from 'react';
import './App.css';
import { makeTimelineRows, makeOptimizedTimelineItems, makeTimelineRowsImproved } from './timeline'

const timelineDuration = 1000 * 60 * 2.5
const componentDurationMultiplier = 300
const componentCount = 100
const benchmarkLoadFactor = 100

const timelineConfig = {
  timelineDuration,
  timelineTolerance : 1500,
  durationTolerance : 500
}

function makeRandomHue(){
  return Math.floor(Math.random() * 360)
}

function generateTestTimelineData(){
  const timelineData = []
  for (var i = 0; i < componentCount; i++) {
    const duration = Math.floor(Math.random() * 10 * componentDurationMultiplier) + 1000
    timelineData.push({
      startTime: Math.floor(Math.random() * Math.round(timelineDuration-(timelineDuration*0.1))),
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

class App extends Component {
  constructor(props){
    super(props)
    this.state = {
      benchmarkStats: undefined,
      timelineInRows: [],
      optimizedTimelineRows: []
    }
  }
  componentDidMount(){
    this.generateDebugTimelines()
  }
  runBenchmark(){
    const optimizationTimes = []
    const rowCounts = []
    const naiveRowCounts = []
    for (var i = 0; i < benchmarkLoadFactor; i++) {
      console.log(`running ${i+1}...`)
      const testData = generateTestTimelineData()
      const perfStart = performance.now()
      const {optimizedItems} = makeOptimizedTimelineItems(timelineConfig, testData)
      const perfEnd = performance.now()
      optimizationTimes.push(perfEnd-perfStart)
      rowCounts.push(makeTimelineRowsImproved(optimizedItems).length)
      naiveRowCounts.push(makeTimelineRows(testData).length)
    }
    const benchmarkStats = {
      perfAverage: parseInt(optimizationTimes.reduce((a,b) => a+b,0) / optimizationTimes.length, 10),
      rowsAverage: rowCounts.reduce((a,b) => a+b,0) / rowCounts.length,
      naiveRowsAverage: naiveRowCounts.reduce((a,b) => a+b,0) / naiveRowCounts.length,
    }
    this.setState({benchmarkStats})
    console.log(`done`)
  }
  generateDebugTimelines(){
    const timelineItems = generateTestTimelineData()
    const timelineInRows = makeTimelineRows(timelineItems)
    let optimizedTimelineItems, optimizedConstraintDebugMap
    try {
      const {optimizedItems, constraintDebugMap} = makeOptimizedTimelineItems(Object.assign({isDebug: true}, timelineConfig), timelineItems)
      optimizedTimelineItems = optimizedItems
      optimizedConstraintDebugMap = constraintDebugMap
    } catch(err){
      optimizedTimelineItems = []
      console.error('NOPE', err)
    }
    const optimizedTimelineRows = makeTimelineRowsImproved(optimizedTimelineItems)
    this.setState({
      timelineInRows,
      optimizedTimelineRows,
      optimizedConstraintDebugMap
    })
  }
  handleMouseOver(id){
    this.setState({hoveredId: id})
  }
  handleMouseOut(){
    this.setState({hoveredId: undefined})
  }
  render() {
    return (
      <div className="wrapper">
        <input type="button" value="regen debug" onClick={this.generateDebugTimelines.bind(this)} />
        <input type="button" value="run benchmark" onClick={this.runBenchmark.bind(this)} />
        {this.state.benchmarkStats && <p>perf avg: {this.state.benchmarkStats.perfAverage}, row count avg: {this.state.benchmarkStats.rowsAverage} (naive avg: {this.state.benchmarkStats.naiveRowsAverage})</p>}
        <h1>naive</h1>
        <div className="timeline">
          {this.state.timelineInRows.map((rowItems, i) => {
            return <div key={i} style={{position:'relative', height: 10, top: 2}}>
                    {rowItems.map((item, i) => {
                      return <div key={`naive-${i}`} className="timelineItem" style={{background: `hsla(${item.hue}, 100%, 50%, .${100-item.priority})`, left: `${(getValue(item.startTime) / timelineDuration)*100}%`, width: `${(getValue(item.duration) / timelineDuration)*100}%`}}></div>
                    })}
                   </div>
          })}
        </div>
        <h1>optimized</h1>
        <div className="timeline">
          {this.state.optimizedTimelineRows.map((rowItems, i) => {
            return <div key={i} style={{position:'relative', height: 10, top: 2}}>
                    {rowItems.map((item, i) => {
                      const naturalColor = `hsla(${item.hue}, 100%, 50%, .${100-item.priority})`
                      return <div
                              key={`opt-${i}`}
                              onMouseOver={this.handleMouseOver.bind(this, item.id)}
                              onMouseOut={this.handleMouseOut.bind(this)}
                              className="timelineItem"
                              style={{
                                fontSize: 9,
                                transition: 'background .2s',
                                background: !this.state.hoveredId ? naturalColor : ((this.state.optimizedConstraintDebugMap[`constraints-${this.state.hoveredId}`]||[]).indexOf(item.id) !== -1 || this.state.hoveredId === item.id ? naturalColor : '#eee'),
                                left: `${(getValue(item.startTime) / timelineDuration)*100}%`,
                                width: `${((getValue(item.endTime)-getValue(item.startTime)) / timelineDuration)*100}%`
                              }}>{this.state.hoveredId === item.id && item.id}</div>
                    })}
                   </div>
          })}
        </div>
      </div>
    );
  }
}

export default App;
