"use strict";

/*
*
* Various helper methods for working with trees
*
* */

const tree_helpers = {

	/*
	* Returns cross-section of full_mappings_tree and node_mappings_tree
	* @return {object} Returns a cross-section of two trees
	* Example:
	* if full_mappings_tree is like this:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* 				Agent
	* 					Agent Name
	* 			#2
	* 				Agent
	* 					Agent Type
	* 					Agent Name
	* 				Remarks
	* And node_mappings_tree is like this:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* This function will return the following object:
	* 	Agent
	* 		Agent Type
	* 		Agent Name
	* 	Remarks
	* */
	traverse_tree(
		/* object */ full_mappings_tree,  // full tree with various branches
		/* object */ node_mappings_tree  // a tree several levels deep with only a single branch
	){

		if (typeof node_mappings_tree === "undefined")
			return full_mappings_tree;

		let target_key = '';
		if (typeof node_mappings_tree === "string")
			target_key = node_mappings_tree;
		else {
			target_key = Object.keys(node_mappings_tree).shift();

			if (typeof target_key === "undefined")
				return full_mappings_tree;
		}

		if (typeof full_mappings_tree[target_key] === "undefined")
			return false;

		return tree_helpers.traverse_tree(full_mappings_tree[target_key], node_mappings_tree[target_key]);

	},

	/*
	* Merges objects recursively (by reference only, does not create a copy of the tree)
	* @return {object} Merged tree
	* For example, if target is:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* 				Agent
	* 				Remarks
	* And source is:
	* 	Accession
	* 		Accession Agents
	* 			#2
	* 				Agent
	* Resulting tree is:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* 				Agent
	* 					Remarks
	* 			#2
	* 				Agent
	* */
	deep_merge_object: (
		/* object */ target,  // tree that is used as a basis
		/* object */ source  // tree that is used as a source
	) =>
		Object.entries(source).reduce((target, [source_property, source_value]) => {

			if (typeof target[source_property] === "undefined")
				target[source_property] = source_value;
			else
				target[source_property] = tree_helpers.deep_merge_object(target[source_property], source_value);

			return target;

		}, target),

	/*
	* Converts an array to tree
	* @return {object} resulting tree
	* Example:
	* 	if
	* 		array is ['accession', 'accession agents', '#1, 'agent', 'first name']
	* 		has_headers is False
	* 	then result is {
	* 		'accession': {
	* 			'accession_agents': {
	* 				'#1': {
	* 					'agent': {
	* 						'first_name': {
	*
	* 						},
	* 					}
	* 				}
	* 			}
	* 		}
	* 	}
	*
	* 	if
	* 		array is ['accession', 'accession agents', '#1, 'agent', 'first name', 'existing_header', 'Agent 1 First Name']
	* 		has_headers is True
	* 	then result is {
	* 		'accession': {
	* 			'accession_agents': {
	* 				'#1': {
	* 					'agent': {
	* 						'first_name': {
	* 							'existing_header': 'Agent 1 First Name',
	* 						},
	* 					}
	* 				}
	* 			}
	* 		}
	* 	}
	*
	* */
	array_to_tree(
		/* array */ array,  // array to be converted
		/* boolean */ has_headers = false  // whether an array has headers in it
	){

		if (array.length === 0)
			return {};

		const node = array.shift();

		if (has_headers && array.length === 0)
			return node;

		return {[node]: tree_helpers.array_to_tree(array, has_headers)};

	},

	/*
	* Converts array of arrays of strings into a complete tree
	* The inverse of mappings_tree_to_array_of_mappings
	* @return {object} Final tree
	* For example if array is:
	* 	Accession, Accession Agents, #1, Agent, First Name
	* 	Accession, Accession Agents, #1, Agent, Last Name
	* 	Accession, Accession Agents, #1, Remarks
	* Resulting tree would be:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* 				Agent
	* 					First Name
	* 					Last Name
	* 				Remarks
	* */
	array_of_mappings_to_mappings_tree(
		/* array */ array_of_mappings,  // array of array of strings (a.k.a branches of the tree) that are going to be merged into a tree
		/* boolean */ include_headers  // whether array_of_mappings includes mapping types and header names / static column values
	){

		const tree = {};

		for (const mapping_path of array_of_mappings) {
			const mapping_tree = tree_helpers.array_to_tree(mapping_path, include_headers);
			tree_helpers.deep_merge_object(tree, mapping_tree);
		}

		return tree;

	},


	/*
	* Converts mappings tree to array of mappings
	* The inverse of array_of_mappings_to_mappings_tree
	* @return {array} Returns array of arrays of string
	* For example, if mappings_tree is:
	* 	Accession
	* 		Accession Agents
	* 			#1
	* 				Agent
	* 					First Name
	* 					Last Name
	* 				Remarks
	* Result would be:
	* 	Accession, Accession Agents, #1, Agent, First Name
	* 	Accession, Accession Agents, #1, Agent, Last Name
	* 	Accession, Accession Agents, #1, Remarks
	* */
	mappings_tree_to_array_of_mappings: (
		/* object */ mappings_tree,  //  mappings tree
		/* array */ path = []  // used in recursion to store intermediate path
	) =>
		Object.entries(mappings_tree).reduce((result, [tree_node_name, tree_node]) => {

			if (typeof tree_node !== "object")
				result.push([...path, tree_node_name, tree_node]);
			else
				result.push(
					...tree_helpers.mappings_tree_to_array_of_mappings(
						mappings_tree[tree_node_name],
						[...path, tree_node_name]
					)
				);

			return result;

		}, []),


};

module.exports = tree_helpers;