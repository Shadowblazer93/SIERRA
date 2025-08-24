export class Circle {
  constructor(parameters) {
    const {id, position, type, data, color, radius, componentType} = parameters
    this.id = id // if predicate: [attr; eg. country] else Node: "0/1/2..."
    this.position = position // can be undefined if predicate
    this.type = type //* to know which style of circle to use
    this.data = data //* Circle[]
    this.color = color
    this.isBold = false
    this.componentType = componentType // componentType === "NODE" | "PREDICATE"
    this.radius = componentType === "NODE" ? 40 : 8 // 80 if
    if (componentType === "NODE") {
      this.ranTheta = parameters.ranTheta ?? Math.random() * 2 * Math.PI
    }
  }

  //* visual shape operators
  up(){
    const increase = this.componentType === "NODE" ? 8 : 2
    this.radius = this.radius + increase
    return increase
  }

  down(){
    const increase = this.componentType === "NODE" ? 8 : 2
    this.radius = this.radius - increase
    return increase
  }

  bold() {
    this.isBold = !this.isBold
  }

  join(circle){

    if (this.componentType === "PREDICATE") {
      //* two predicate circles join
      const increase = this.up()
      this.data.push(...circle.data)
      if(this.position) {
        this.position = {
          x: this.position.x - increase,
          y: this.position.y - increase
        }
      }

    } else {
      //* Node and predicate circle join
      this.up()
      this.data.predicates[circle.id] = circle

      //* update positions of every predicate circle
      const attr = circle.id
      let containsEmpty = false

      for (const [index, pos] of this.data.VEDAPosition.entries()) {
        if (pos === ''){
          //* VEDAPosition contains a previously deleted slot
          const newPos = [...this.data.VEDAPosition]
          newPos[index] = attr
          this.data.VEDAPosition = newPos
          containsEmpty = true
          break;
        }
      }
      //* VEDAPosition has no empty slot
      if (!containsEmpty) {
        this.data.VEDAPosition.push(attr)
      }
      this.updatePredicatePositions()

    }
  }

  detach(key) {
    if(this.componentType === "PREDICATE") {
      const decrease = this.down()
      let data = [...this.data]
      data.splice(key, 1)

      this.data = data
      if(this.position) {
        this.position = {
          x: this.position.x + decrease,
          y: this.position.y + decrease
        }
      }

    } else {
      this.down()
      const preds = {...this.data.predicates}
      delete preds[key]
      const i = this.data.VEDAPosition.indexOf(key)
      if (i !== -1) {
        this.data.VEDAPosition[i] = ""
      }
      this.data.predicates = preds

      this.updatePredicatePositions()
    }
  }

  updatePredicatePositions() {
    //* update positions {x, y} for all children circles
    let theta = {};
    const {predicates, VEDAPosition} = this.data
    let n = Object.keys(predicates).length;
    let i = 0
    for (const pre of VEDAPosition) {
      let angle = this.ranTheta + ((2 * i * Math.PI) / (VEDAPosition.length + 4))
        let checkAngle = angle % (Math.PI / 2)
        while ( checkAngle < 0.261799 || checkAngle > (Math.PI / 2) - 0.261799 ) {
          i++;
          angle = this.ranTheta + ((2 * i * Math.PI) / (VEDAPosition.length + 4))
          checkAngle = angle % (Math.PI / 2)
      }
      if (pre !== '') {
        theta[pre] = angle
      }
      i++;
    }

    Object.keys(predicates).forEach(pred => {
      //* pred is a Circle
      const predCircle = this.data.predicates[pred]
      predCircle.position = {
        x: this.radius + parseInt(Math.round(this.radius * Math.sin(theta[predCircle.id]))) - predCircle.radius,
        y: this.radius - parseInt(Math.round(this.radius * Math.cos(theta[predCircle.id]))) - predCircle.radius,
      }
    })
  }
}

export class Arrow {
  constructor(parameters) {

    const {id, data, source, target, arrowHeadType, type} = parameters
    this.id = id
    this.data = data
    this.source = source
    this.target = target
    this.arrowHeadType = arrowHeadType
    this.type = type //* to know which style of arrows to use
  }

  join(circle) {
    this.data.predicates[circle.id] = circle
  }

  detach(key) {
    const preds = {...this.data.predicates}
    delete preds[key]
    this.data.predicates = preds
  }

}
