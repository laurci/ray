package raysoc

import spinal.core._
import spinal.core.sim._

object RaySocSim extends App {
  Config.sim.compile(RaySoc()).doSim { dut =>
    dut.clockDomain.forkStimulus(period = 10)

    var modelState = 0
    for (idx <- 0 to 99) {
      dut.io.cond0.randomize()
      dut.io.cond1.randomize()

      dut.clockDomain.waitRisingEdge()

      val modelFlag = modelState == 0 || dut.io.cond1.toBoolean
      assert(dut.io.state.toInt == modelState)
      assert(dut.io.flag.toBoolean == modelFlag)

      if (dut.io.cond0.toBoolean) {
        modelState = (modelState + 1) & 0xff
      }
    }
  }
}
