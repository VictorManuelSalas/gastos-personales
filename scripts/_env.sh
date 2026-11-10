# Lee .env sin ejecutarlo (los valores pueden tener espacios o símbolos).
# Las variables ya definidas en el entorno tienen prioridad.
load_env() {
  [ -f "${1:-.env}" ] || return 0
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line=${line%$'\r'}
    case "$line" in ''|\#*) continue ;; esac
    key=${line%%=*}; val=${line#*=}
    [[ $key =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ $val == \"*\" || $val == \'*\' ]]; then val=${val:1:${#val}-2}; fi
    [ -z "${!key+x}" ] && export "$key=$val"
  done < "${1:-.env}"
}
