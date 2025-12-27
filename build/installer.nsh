; Автоматически закрываем запущенный процесс перед установкой/обновлением
!include "LogicLib.nsh"

!macro customInit
  ; Electron Builder задаёт PRODUCT_FILENAME (= productName без пробелов) и APP_EXECUTABLE
  StrCpy $0 "${PRODUCT_FILENAME}.exe"
  ; На всякий случай пробуем альтернативное имя с дефисом
  StrCpy $1 "ttt-meta.exe"

  ; До 5 попыток закрыть возможные процессы через taskkill/PowerShell (без плагинов)
  StrCpy $5 0
  ${DoWhile} $5 < 5
    ; основное имя
    nsExec::ExecToLog 'taskkill /IM "$0" /T /F'
    ; альтернативное
    nsExec::ExecToLog 'taskkill /IM "$1" /T /F'
    ; запасной electron.exe (если что-то осталось от dev)
    nsExec::ExecToLog 'taskkill /IM "electron.exe" /T /F'
    ; powershell на случай других имён/инстансов
    nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process meTTTa,mettta,''ttt-meta'' -ErrorAction SilentlyContinue | Stop-Process -Force"'
    Sleep 500
    IntOp $5 $5 + 1
  ${Loop}
!macroend

