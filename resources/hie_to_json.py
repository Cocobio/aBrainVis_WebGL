import json
import sys, getopt

input_file = ""
output_file = ""

def missing_arg():
	print('hie_to_json.py -i <input_file> -o <output_file>')
	sys.exit(2)

# Inputs parsing
if len(sys.argv)==1:
	missing_arg()
try:
	opts, args = getopt.getopt(sys.argv[1:],"hi:o:",["ifile=","ofile="])
except getopt.GetoptError:
	missing_arg()

for opt, arg in opts:
	if opt == '-h':
		print('hie_to_json.py -i <input_file> -o <output_file>')
		sys.exit()
	elif opt in ("-i", "--ifile"):
		input_file = arg
	elif opt in ("-o", "--ofile"):
		output_file = arg

if input_file=="" or output_file=="":
	missing_arg()

# Dict construction
colors = {}

# Parsing fascicle with color
with open(input_file) as input_f:
	lines = input_f.readlines()

	name = ""
	for line in lines:
		if line.startswith("name"):
			name = line.split()[1]
		elif line.startswith("color"):
			color = [int(x) for x in line.split()[1:]]
			colors[name] = color

# Creating json
if not output_file.endswith(".json"):
	output_file += ".json"

with open(output_file, "w") as output_f:
	json.dump({"colors":colors}, output_f, indent=4)