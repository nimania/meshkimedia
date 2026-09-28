"""Format Gregorian source dates for the Persian-facing site and social art."""
from datetime import date
from functools import lru_cache
import subprocess


@lru_cache(maxsize=256)
def solar_date(value, numeric=False):
    if "." in value:
        value = "-".join(reversed(value.split(".")))
    date.fromisoformat(value)
    script = """const [value, numeric] = process.argv.slice(1);
      const options = numeric === 'true'
        ? {year:'numeric', month:'2-digit', day:'2-digit', timeZone:'UTC'}
        : {year:'numeric', month:'long', day:'numeric', timeZone:'UTC'};
      process.stdout.write(new Intl.DateTimeFormat('fa-IR-u-ca-persian', options)
        .format(new Date(value + 'T12:00:00Z')));"""
    return subprocess.check_output(["node", "-e", script, value, str(numeric).lower()], text=True)
