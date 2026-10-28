; Подключается electron-builder'ом (package.json → build.nsis.include).
;
; При обновлении ярлыки на рабочем столе и в «Пуске» не пересоздаются, а Explorer
; держит их картинку в кэше иконок — после смены иконки приложения ярлык оставался
; со старой, хотя у нового exe иконка уже новая. SHChangeNotify(SHCNE_ASSOCCHANGED)
; сбрасывает этот кэш, и ярлыки перерисовываются из exe.
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
