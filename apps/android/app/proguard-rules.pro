# Silvae release rules. Keep the first release conservative; R8's defaults
# handle Compose and Firebase. Add narrowly scoped rules only when a release
# build or a device test demonstrates that they are required.

# Hilt discovers generated classes at compile time; no broad keep rule needed.
