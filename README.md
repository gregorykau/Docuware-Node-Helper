# Docuware Node Helper
A simple helper script for interacting with Docuware either **programmatically** or via the **CMD**.

All calls require an endpoint -e and either a token -t or cookie -x (except for authentication requests).
It may be useful to generate and then re-use cookies in subsequent calls when your license does not allow for multiple active sessions.

## Authentication: 
### Generating a token for re-use:
```
node docuware.js -m gentoken -u "username" -p "password" -h "123-456-789-xxxx-xxxx" -e "https://test.docuware.cloud"
```
### Generating a cookie for re-use:
```
node docuware.js -m gencookie -u "username" -p "password" -h "123-456-789-xxxx-xxxx" -e "https://test.docuware.cloud"
```

## Cabinet Listing:
```
node docuware.js -m lscabinets -e "https://test.docuware.cloud" -t "ABC"
```

## Geting document/s (JSON):
### With a server-side query -q:
```
node docuware.js -c "Meter - STG" -m get -q "SERIAL_NO = [3080RC20119]" -e "https://test.docuware.cloud" -t "ABC"
```

### With a client-side predicate -f: (NOTE: this will cause ALL records from cabinet to be fetched and filtered locally)
```
node docuware.js -c "Meter - STG" -m get -f "fields['SERIAL_NO'] == '3080RC20114'" -e "https://test.docuware.cloud" -t "ABC"
```

### With a provided docuware ID -i: 
```
node docuware.js -c "Meter - STG" -m get -i 1 -e "https://test.docuware.cloud" -t "ABC"
```

## Downloading document/s

### With a server-side query -q:
Queries are of the form FIRST_FIELD_NAME = [VALUE] | SECOND_FIELD_NAME = [VALUE2] ...
```
node docuware.js -c "Meter - STG" -m download -q "SERIAL_NO = [3080RC20114]" -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
```

### With a client-side predicate -f:
```
node docuware.js -c "Meter - STG" -m download -f "fields['SERIAL_NO'] == '3080RC20114'" -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
```

### With a provided docuware ID -i: 
```
node docuware.js -c "Meter - STG" -m download -i 1 -n "testdoc" -p "C:\Users\kgregory\Documents\GitHub\ricohmy\tmp" -e "https://test.docuware.cloud" -t "ABC"
```

## Updating a document:

### With a server-side query -q:
```
node docuware.js -c "Meter - STG" -m update -q "SERIAL_NO = [3080RC20114]" -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
```

### With a client-side predicate -f:
```
node docuware.js -c "Meter - STG" -m update -f "fields['SERIAL_NO'] == '3080RC20114'" -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
```

### With a provided docuware ID -i: 
```
node docuware.js -c "Meter - STG" -m update -i 1 -u "{'SERIAL_NO': '3080RC20119'}" -e "https://test.docuware.cloud" -t "ABC"
```

## Uploading a document:

```
node docuware.js -c "Meter - STG" -m upload -p "C:\Users\kgregory\Desktop\TEST DOCUMENT.pdf" -e "https://test.docuware.cloud" -t "ABC"
```
