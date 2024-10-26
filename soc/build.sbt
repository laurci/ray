ThisBuild / version := "1.0"
ThisBuild / scalaVersion := "2.13.12" // Adjusted to the latest stable version for the 2.13 series
ThisBuild / organization := "com.github.laurci"

val spinalVersion = "1.10.2a"
val spinalCore = "com.github.spinalhdl" %% "spinalhdl-core" % spinalVersion
val spinalLib = "com.github.spinalhdl" %% "spinalhdl-lib" % spinalVersion

val spinalIdslPlugin = compilerPlugin("com.github.spinalhdl" %% "spinalhdl-idsl-plugin" % spinalVersion)

lazy val raysoc = (project in file("."))
  .settings(
    Compile / scalaSource := baseDirectory.value / "hw" / "spinal",
    libraryDependencies ++= Seq(spinalCore, spinalLib, spinalIdslPlugin)
  )
  .dependsOn(root)

lazy val root = (project in file("vendor/VexRiscv"))

fork := true
