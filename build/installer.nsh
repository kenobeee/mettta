; Автоматически закрываем запущенный процесс перед установкой/обновлением
!include "LogicLib.nsh"

!macro customInit
  ; Electron Builder задаёт PRODUCT_FILENAME (= productName без пробелов) и APP_EXECUTABLE
  StrCpy $0 "${PRODUCT_FILENAME}.exe"
  ; На всякий случай пробуем альтернативное имя с дефисом
  StrCpy $1 "ttt-meta.exe"

  Call KillIfRunning
!macroend

Function KillIfRunning
  ; До 3 попыток закрыть оба процесса
  StrCpy $5 0
  ${DoWhile} $5 < 3
    nsProcess::FindProcess "$0"
    Pop $3
    ${If} $3 = 0
      nsProcess::KillProcess "$0"
      Pop $4
      Sleep 500
    ${EndIf}

    nsProcess::FindProcess "$1"
    Pop $3
    ${If} $3 = 0
      nsProcess::KillProcess "$1"
      Pop $4
      Sleep 500
    ${EndIf}

    IntOp $5 $5 + 1
  ${Loop}
FunctionEnd

