package raysoc.utils

import java.nio.file.{Files, Paths}
import java.math.BigInteger
import scala.language.implicitConversions

object Bin {
    def loadProgram(path: String, padToWordCount: Int): Array[BigInt] = {
        Files.readAllBytes(Paths.get(path))
            .grouped(4)
            .map(wordBytes => {
                BigInt(new BigInteger(
                    wordBytes.padTo(8, 0.toByte).reverse.toArray))
            })
            .padTo(padToWordCount, BigInt(0))
            .toArray
    }
}