package raysoc

import raysoc.utils.Bin

import spinal.core._

import vexriscv._
import vexriscv.plugin._
import spinal.lib.bus.amba4.axi._
import spinal.lib.bus.amba3.apb._
import spinal.lib.com.uart._
import spinal.lib.io._
import spinal.lib.master
import scala.collection.mutable.ArrayBuffer
import spinal.lib.bus.misc.SizeMapping

case class RaySoc() extends Component {
  val io = new Bundle {
    val leds = out Bits(4 bits)
    val uart = master(Uart())
  }

  val plugins = List(
    new PcManagerSimplePlugin(0x00000000l, false),
    new IBusSimplePlugin(
        resetVector = 0x00000000l,
        compressedGen = true,
        cmdForkOnSecondStage = true,
        cmdForkPersistence  = true
    ),
    new DBusSimplePlugin(
        catchAddressMisaligned = false,
        catchAccessFault = false
    ),
    new DecoderSimplePlugin(
        catchIllegalInstruction = false
    ),
    new RegFilePlugin(
        regFileReadyKind = plugin.SYNC,
        zeroBoot = true
    ),
    new IntAluPlugin,
    new MulPlugin,
    new DivPlugin,
    new SrcPlugin(
        separatedAddSub = false,
        executeInsertion = false
    ),
    new LightShifterPlugin,
    new HazardSimplePlugin(
        bypassExecute           = false,
        bypassMemory            = false,
        bypassWriteBack         = false,
        bypassWriteBackBuffer   = false
    ),
    new BranchPlugin(
        earlyBranch = false,
        catchAddressMisaligned = false
    ),
    new CsrPlugin(
      config = CsrPluginConfig(
        catchIllegalAccess = false,
        mvendorid      = null,
        marchid        = null,
        mimpid         = null,
        mhartid        = null,
        misaExtensionsInit = 66,
        misaAccess     = CsrAccess.NONE,
        mtvecAccess    = CsrAccess.NONE,
        mtvecInit      = 0x80000020l,
        mepcAccess     = CsrAccess.READ_WRITE,
        mscratchGen    = false,
        mcauseAccess   = CsrAccess.READ_ONLY,
        mbadaddrAccess = CsrAccess.READ_WRITE,
        mcycleAccess   = CsrAccess.NONE,
        minstretAccess = CsrAccess.NONE,
        ecallGen       = false,
        wfiGenAsWait   = false,
        ucycleAccess   = CsrAccess.NONE
      )
    )
  )

  val resetCtrlDomain = ClockDomain.external(
    "",
    ClockDomainConfig(resetKind=BOOT),
    frequency = FixedFrequency(100 MHz)
  )

  val resetCtrl = new ClockingArea(resetCtrlDomain) {
      val systemReset = RegInit(True)
      val resetCounter = RegInit(U"6'h0")
      when (resetCounter =/= 63) {
          resetCounter := resetCounter + 1
      } otherwise {
          systemReset := False
      }
  }

  val coreDomain = ClockDomain(
      clock = resetCtrlDomain.readClockWire,
      reset = resetCtrl.systemReset,
      frequency = resetCtrlDomain.frequency
  )

  val core = new ClockingArea(coreDomain) {
    val config = VexRiscvConfig(plugins)

    val cpu = new VexRiscv(config)

    var iBus : Axi4ReadOnly = null
    var dBus : Axi4Shared = null

    for (plugin <- config.plugins) plugin match {
        case plugin : IBusSimplePlugin => iBus = plugin.iBus.toAxi4ReadOnly()
        case plugin : DBusSimplePlugin => dBus = plugin.dBus.toAxi4Shared()
        case plugin : CsrPlugin => {
            plugin.externalInterrupt := False
            plugin.timerInterrupt := False
        }
        case _ =>
    }

    val memory = Axi4SharedOnChipRam(
        dataWidth = 32,
        byteCount = 4 kB,
        idWidth = 4
    )   

    var programPath = sys.env.get("FIRMWARE_BIN_PATH").getOrElse("../target/riscv32imac-unknown-none-elf/release/firmware-test.bin")
    if(programPath == "") {
      println("FIRMWARE_BIN_PATH missing. set it to the path of the test firmware binary")
    }

    println("Loading program from" + programPath)

    val program = Bin.loadProgram(programPath, 1024)
    memory.ram.initBigInt(program)

    val apbBridge = Axi4SharedToApb3Bridge(
        addressWidth = 32,
        dataWidth = 32,
        idWidth = 0
    )

    val axiCrossbar = Axi4CrossbarFactory()
    axiCrossbar.addSlaves(
        memory.io.axi    -> (0x00000000L,   4 kB),
        apbBridge.io.axi -> (0x10000000L,   1 MB),
    )

    axiCrossbar.addConnections(
        iBus -> List(memory.io.axi),
        dBus -> List(memory.io.axi, apbBridge.io.axi)
    )

    axiCrossbar.build()

    val apbMapping = ArrayBuffer[(Apb3, SizeMapping)]()

    val ledCtrl = Apb3Gpio(
      gpioWidth = 4,
      withReadSync = true
    )
    apbMapping += ledCtrl.io.apb -> (0x10000000L, 4 kB)


  val uartCtrl = Apb3UartCtrl(UartCtrlMemoryMappedConfig(
      uartCtrlConfig = UartCtrlGenerics(
        dataWidthMax      = 8,
        clockDividerWidth = 20,
        preSamplingSize   = 1,
        samplingSize      = 5,
        postSamplingSize  = 2
      ),
      initConfig = UartCtrlInitConfig(
        baudrate = 115200,
        dataLength = 7,  //7 => 8 bits
        parity = UartParityType.NONE,
        stop = UartStopType.ONE
      ),
      txFifoDepth = 16,
      rxFifoDepth = 16
    ))
    apbMapping += uartCtrl.io.apb -> (0x10010000L, 4 kB)

    // val ml = MlExec()
    // apbMapping += ml.io.apb -> (0x10020000L, 4 kB)

    val apbDecoder = Apb3Decoder(
      master = apbBridge.io.apb,
      slaves = apbMapping.toSeq
    )
    
    io.leds <> ledCtrl.io.gpio.write(3 downto 0)
    ledCtrl.io.gpio.read <> 0
    
    io.uart <> uartCtrl.io.uart
  }

  noIoPrefix()
}

object RaySocVerilog extends App {
  Config.spinal.generateVerilog(RaySoc())
}
