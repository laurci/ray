package raysoc.utils

import scala.io.Source
import upickle.default._

case class RSNData(
  layers: List[Int],
  weights: List[List[List[Int]]],
  biases: List[List[Int]]
)

object RSNData {
  implicit val rw: ReadWriter[RSNData] = macroRW
}

object RSNReader {
  def readNetworkData(filename: String): RSNData = {
    val source = Source.fromFile(filename)
    val jsonString = try source.mkString finally source.close()
    read[RSNData](jsonString)
  }

  def convertNetworkData(nd: RSNData): (List[Int], List[Array[Array[Int]]], List[Array[Int]]) = {
    val layers = nd.layers
    val weights = nd.weights.map { layerWeights =>
      layerWeights.map(_.toArray).toArray
    }
    val biases = nd.biases.map(_.toArray)
    (layers, weights, biases)
  }
}
