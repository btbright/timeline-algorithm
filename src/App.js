import React, { Component } from 'react';
import './App.css';
import { makeTimelineRows, makeOptimizedTimelineItems, makeTimelineRowsImproved } from './timeline'

const timelineDuration = 10000
const componentDurationMultiplier = 300
const componentCount = 10
const benchmarkLoadFactor = 5

const timelineConfig = {
  timelineDuration,
  timelineTolerance : 2000,
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
      startTime: Math.floor(Math.random() * timelineDuration),
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
      perfAverage: undefined,
      timelineInRows: [],
      optimizedTimelineRows: []
    }
  }
  componentDidMount(){
    this.generateDebugTimelines()
  }
  runBenchmark(){
    const optimizationTimes = []
    for (var i = 0; i < benchmarkLoadFactor; i++) {
      console.log(`running ${i+1}...`)
      const testData = generateTestTimelineData()
      const perfStart = performance.now()
      makeOptimizedTimelineItems(timelineConfig, testData)
      const perfEnd = performance.now()
      optimizationTimes.push(perfEnd-perfStart)
    }
    this.setState({
      perfAverage: parseInt(optimizationTimes.reduce((a,b) => a+b,0) / optimizationTimes.length, 10)
    })
    console.log(`done`)
  }
  generateDebugTimelines(){
    const timelineItems = generateTestTimelineData()
    const timelineInRows = makeTimelineRows(timelineItems)
    let optimizedTimelineItems
    try {
      optimizedTimelineItems = makeOptimizedTimelineItems(Object.assign({isDebug: true}, timelineConfig), timelineItems)
    } catch(err){
      optimizedTimelineItems = []
      console.error('NOPE')
    }
    const optimizedTimelineRows = makeTimelineRowsImproved(optimizedTimelineItems)
    this.setState({
      timelineInRows,
      optimizedTimelineRows
    })
  }
  render() {
    return (
      <div className="wrapper">
        <input type="button" value="regen debug" onClick={this.generateDebugTimelines.bind(this)} />
        <input type="button" value="run benchmark" onClick={this.runBenchmark.bind(this)} />
        {this.state.perfAverage && <p>avg: {this.state.perfAverage}</p>}
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
                      return <div key={`opt-${i}`} className="timelineItem" style={{fontSize: 9, background: `hsla(${item.hue}, 100%, 50%, .${100-item.priority})`, left: `${(getValue(item.startTime) / timelineDuration)*100}%`, width: `${((getValue(item.endTime)-getValue(item.startTime)) / timelineDuration)*100}%`}}></div>
                    })}
                   </div>
          })}
        </div>
      </div>
    );
  }
}

export default App;
