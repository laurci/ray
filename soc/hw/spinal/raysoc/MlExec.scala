package raysoc
import spinal.core._
import spinal.lib.fsm._
import raysoc.utils.RSNReader
import spinal.lib.slave
import spinal.lib.bus.amba3.apb._
import spinal.lib.bus.tilelink.Param
import raysoc.Params.{MAX_OUTPUT_SIZE => MAX_OUTPUT_SIZE}

case object Params {
  val MAX_MAC_ARRAY_SIZE = 70
  val MAX_INPUT_SIZE = 128
  val MAX_OUTPUT_SIZE = 32
}

case class Sigmoid() extends Component {
  val io = new Bundle {
    val x = in SInt(32 bits)
    val y = out SInt(8 bits)
  }

  val x_shifted = io.x >> 7

  val x_clamped = SInt(5 bits)
  when(x_shifted > 8) {
    x_clamped := 8
  } elsewhen(x_shifted < -8) {
    x_clamped := -8
  } otherwise {
    x_clamped := x_shifted.resize(5 bits)
  }

  val index = SInt(5 bits)
  index := (x_clamped + 8).resize(5 bits)

  val sigmoid_output = SInt(8 bits)
  switch(index) {
    is(S(0))  { sigmoid_output := S(0, 8 bits) }
    is(S(1))  { sigmoid_output := S(4, 8 bits) }
    is(S(2))  { sigmoid_output := S(8, 8 bits) }
    is(S(3))  { sigmoid_output := S(15, 8 bits) }
    is(S(4))  { sigmoid_output := S(26, 8 bits) }
    is(S(5))  { sigmoid_output := S(41, 8 bits) }
    is(S(6))  { sigmoid_output := S(60, 8 bits) }
    is(S(7))  { sigmoid_output := S(81, 8 bits) }
    is(S(8))  { sigmoid_output := S(103, 8 bits) }
    is(S(9))  { sigmoid_output := S(122, 8 bits) }
    default   { sigmoid_output := S(127, 8 bits) }
  }

  io.y := sigmoid_output
}


case class MacUnit() extends Component {
  val io = new Bundle {
    val en = in Bool()
    val set = in Bool()
    val a = in  SInt(8 bits)
    val b = in  SInt(8 bits)
    val c = in SInt(32 bits)
    val p = out SInt(32 bits)
  }

  val acc = Reg(SInt(32 bits)) init(0)

  when(io.set) {
    acc := io.c + io.a * io.b
  }

  when(io.en) {
    acc := acc + io.a * io.b
  }

  io.p := acc
}

case class MacArray(count: Int) extends Component {
  val io = new Bundle {
    val en = in Bool()
    val set = in Bool()
    val a = in Vec(SInt(8 bits), count)
    val b = in Vec(SInt(8 bits), count)
    val c = in Vec(SInt(32 bits), count)
    val p = out Vec(SInt(32 bits), count)
  }

  val macs = for (i <- 0 until count) yield new MacUnit

  for (i <- 0 until count) {
    macs(i).io.en := io.en
    macs(i).io.set := io.set
    macs(i).io.a := io.a(i)
    macs(i).io.b := io.b(i)
    macs(i).io.c := io.c(i)
    io.p(i) := macs(i).io.p    
  }
}

case class MLP(layers: List[Int], weights: List[Array[Array[Int]]], biases: List[Array[Int]]) extends Component {
  assert(layers.length > 2)
  assert(layers.length == weights.length + 1)
  assert(layers.length == biases.length + 1)

  val maxLayerSize = layers.max
  val inputLayerSize = layers.head
  val outputLayerSize = layers.last

  val macArraySize = maxLayerSize.max(Params.MAX_MAC_ARRAY_SIZE);

  val io = new Bundle {
    val en = in Bool()
    val input = in Vec(SInt(8 bits), Params.MAX_INPUT_SIZE)
    val output = out Vec(SInt(8 bits), Params.MAX_OUTPUT_SIZE)
    val finished = out Bool()
  }

  val finished = Reg(Bool) init(False)
  io.finished := finished

  val macArray = MacArray(macArraySize)
  val en = Reg(Bool) init(False)
  val set = Reg(Bool) init(False)
  val a = Vec(Reg(SInt(8 bits)) init(0), maxLayerSize)
  val b = Vec(Reg(SInt(8 bits)) init(0), maxLayerSize)
  val c = Vec(Reg(SInt(32 bits)) init(0), maxLayerSize)

  for (i <- 0 until outputLayerSize) {
    io.output(i).setAsReg() init(0)
  }

  val z = Vec(Reg(SInt(8 bits)) init(0), maxLayerSize)
  val activations = Vec(Reg(SInt(8 bits)) init(0), maxLayerSize)

  val sigmoids = for (i <- 0 until maxLayerSize) yield new Sigmoid
  for (i <- 0 until maxLayerSize) {
    sigmoids(i).io.x := macArray.io.p(i)
    activations(i) := sigmoids(i).io.y
  }
  
  macArray.io.en := en
  macArray.io.set := set

  for (i <- 0 until maxLayerSize) {
    macArray.io.a(i) := a(i)
    macArray.io.b(i) := b(i)
    macArray.io.c(i) := c(i)
  }

  val state = Reg(UInt(16 bits)) init(0)
  val layer = Reg(UInt(16 bits)) init(0)

  when(io.en === False) {
    state := 0
    layer := 0
    finished := False
  }

  when(io.en === True && layer === 0 && state === 0) {
    for (i <- 0 until inputLayerSize) {
      z(i) := io.input(i)
    }
    layer := layer + 1
  }

  for (i <- 1 until layers.length) {
    val prevLayerSize = layers(i - 1)
    val currLayerSize = layers(i)

    when(io.en === True && layer === i && state === 0) {
      en := False
      set := True

      for (j <- 0 until currLayerSize) {
        c(j) := biases(i - 1)(j)
        a(j) := z(0)
        b(j) := weights(i - 1)(j)(0)
      }

      state := state + 1
    }

    for (j <- 1 until prevLayerSize) {
      when(io.en === True && layer === i && state === j) {
        en := True
        set := False

        for (k <- 0 until currLayerSize) {
          a(k) := z(j)
          b(k) := weights(i - 1)(k)(j)
        }

        state := state + 1
      }
    }

    when(io.en === True && layer === i && state === prevLayerSize) {
      state := prevLayerSize + 1
    }

    when(io.en === True && layer === i && state === prevLayerSize + 1) {
      en := False
      set := False

      for (j <- 0 until currLayerSize) {
        z(j) := activations(j)
      }

      state := 0
      layer := layer + 1
    }
  }

  when(io.en === True && layer === layers.length) {
    for (i <- 0 until outputLayerSize) {
      io.output(i) := z(i)
    }

    finished := True
  }
}

case class MlExec() extends Component {
    var networkPath = sys.env.get("NETWORK_BIN_PATH").getOrElse("")
    if(networkPath == "") {
        println("NETWORK_BIN_PATH missing. set it to the path of the test firmware binary")
    }

  val networkData = RSNReader.readNetworkData(networkPath)
  val (layers, weights, biases) = RSNReader.convertNetworkData(networkData)

  val io = new Bundle {
    val apb  = slave(Apb3(Apb3Config(addressWidth = 8, dataWidth = 32)))
  }

  val mlp = MLP(layers, weights, biases)

  val ctrl = Apb3SlaveFactory(io.apb)
  val enable = ctrl.createReadAndWrite(Bool(), 0)
  val finished = ctrl.read(Bool(), 4)
  for (i <- 0 until Params.MAX_INPUT_SIZE / 4) {
    val input = ctrl.createReadAndWrite(UInt(32 bits), 8 + i * 4)
    mlp.io.input(i * 4) := input(31 downto 24).asSInt
    mlp.io.input(i * 4 + 1) := input(23 downto 16).asSInt
    mlp.io.input(i * 4 + 2) := input(15 downto 8).asSInt
    mlp.io.input(i * 4 + 3) := input(7 downto 0).asSInt
  }

  for (i <- 0 until Params.MAX_OUTPUT_SIZE / 4) {
    val output = ctrl.driveAndRead(UInt(32 bits), 8 + Params.MAX_INPUT_SIZE + i * 4)
    output(31 downto 24) := mlp.io.output(i * 4).asUInt
    output(23 downto 16) := mlp.io.output(i * 4 + 1).asUInt
    output(15 downto 8) := mlp.io.output(i * 4 + 2).asUInt
    output(7 downto 0) := mlp.io.output(i * 4 + 3).asUInt
  }

  mlp.io.en := enable
  finished := mlp.io.finished
}