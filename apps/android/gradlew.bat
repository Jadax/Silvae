@rem Copyright © 2015-2024 the original authors.
@rem Licensed under the Apache License, Version 2.0.
@if "%DEBUG%"=="" @echo off
@rem ##########################################################################

@setlocal
set "APP_HOME=%~dp0"
set "CLASSPATH=%APP_HOME%gradle\wrapper\gradle-wrapper.jar"

if not exist "%CLASSPATH%" (
  echo ERROR: Gradle wrapper JAR is missing: %CLASSPATH% 1>&2
  exit /b 1
)

if defined JAVA_HOME goto findJavaFromJavaHome
set "JAVA_EXE=java.exe"
%JAVA_EXE% -version >NUL 2>&1
if "%ERRORLEVEL%"=="0" goto execute
echo ERROR: JAVA_HOME is not set and Java was not found on PATH. 1>&2
exit /b 1

:findJavaFromJavaHome
set "JAVA_EXE=%JAVA_HOME%\bin\java.exe"
if exist "%JAVA_EXE%" goto execute
echo ERROR: JAVA_HOME points to an invalid directory: %JAVA_HOME% 1>&2
exit /b 1

:execute
"%JAVA_EXE%" -Xmx64m -Xms64m "-Dorg.gradle.appname=%~n0" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*

@endlocal
