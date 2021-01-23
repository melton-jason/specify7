/*
*
* Helper methods for working with Specify data model as parsed by wbplanview model fetcher
*
* */

'use strict';

import data_model_storage                from './wbplanviewmodel';
import {
	DataModelField,
	DataModelFields,
	DataModelNonRelationship,
	DataModelRelationship,
}                                        from './wbplanviewmodelfetcher';
import { MappingPath, RelationshipType } from './wbplanviewmapper';
import { MappingsTree }                  from './wbplanviewtreehelper';

/* fetch fields for a table */
const get_table_fields = (
	table_name: string,  // the name of the table to fetch the fields for
	filter__is_relationship: boolean | -1 = -1,  // whether fields are relationships
	filter__is_hidden: boolean | -1 = -1,  // whether field is hidden
): [field_name: string, field_data: DataModelField][] =>
	Object.entries(data_model_storage.tables[table_name].fields as DataModelFields).filter(([, {
			is_relationship,
			is_hidden,
		}]) =>
		(
			filter__is_relationship === -1 || is_relationship === filter__is_relationship
		) &&
		(
			filter__is_hidden === -1 || is_hidden === filter__is_hidden
		),
	);

/* fetch fields for a table */
export const get_table_non_relationship_fields = (
	table_name: string,  // the name of the table to fetch the fields for
	filter__is_hidden: boolean | -1 = -1,  // whether field is hidden
) =>
	get_table_fields(
		table_name,
		false,
		filter__is_hidden,
	) as [relationship_name: string, relationship_data: DataModelNonRelationship][];

/* fetch relationships for a table */
export const get_table_relationships = (
	table_name: string,   // the name of the table to fetch relationships fields for,
	filter__is_hidden: boolean | -1 = -1,  // whether field is hidden
) =>
	get_table_fields(
		table_name,
		true,
		filter__is_hidden,
	) as [relationship_name: string, relationship_data: DataModelRelationship][];

/* Returns whether a table has tree ranks */
export const table_is_tree = (
	table_name?: string,
): boolean /* whether a table has tree ranks */ =>  // the name of the table to check
	typeof data_model_storage.ranks[table_name || ''] !== 'undefined';
//typeof table_name !== 'undefined' && typeof data_model_storage.ranks[table_name] !== 'undefined';

/* Returns whether relationship is a -to-many (e.x. one-to-many or many-to-many) */
export const relationship_is_to_many = (
	relationship_type?: RelationshipType | '',
): boolean /* whether relationship is a -to-many */ =>
	(
		relationship_type ?? ''
	).indexOf('-to-many') !== -1;

/* Returns whether a value is a -to-many reference item (e.x #1, #2, etc...) */
export const value_is_reference_item = (
	value?: string,  // the value to use
): boolean /* whether a value is a -to-many reference item */ =>
	value?.substr(0, data_model_storage.reference_symbol.length) === data_model_storage.reference_symbol || false;

/* Returns whether a value is a tree rank name (e.x $Kingdom, $Order) */
export const value_is_tree_rank = (
	value: string,  // the value to use
): boolean /* whether a value is a tree rank */ =>
	value?.substr(0, data_model_storage.tree_symbol.length) === data_model_storage.tree_symbol || false;

/*
* Returns index from a complete reference item value (e.x #1 => 1)
* Opposite of format_reference_item
* */
export const get_index_from_reference_item_name = (
	value: string,  // the value to use
): number =>
	parseInt(value.substr(data_model_storage.reference_symbol.length));

/*
* Returns tree rank name from a complete tree rank name (e.x $Kingdom => Kingdom)
* Opposite of format_tree_rank
* */
export const get_name_from_tree_rank_name = (
	value: string,   // the value to use
): string /*tree rank name*/ =>
	value.substr(data_model_storage.tree_symbol.length);

/* Returns the max index in the list of reference item values */
export const get_max_to_many_value = (
	values: string[],  // list of reference item values
): number /* max index. Returns 0 if there aren't any */ =>
	values.reduce((max, value) => {

		// skip `add` values and other possible NaN cases
		if (!value_is_reference_item(value))
			return max;

		const number = get_index_from_reference_item_name(value);

		if (number > max)
			return number;

		return max;

	}, 0);

/*
* Returns a complete reference item from an index (e.x 1 => #1)
* Opposite of get_index_from_reference_item_name
* */
export const format_reference_item = (
	index: number,  // the index to use
): string /* a complete reference item from an index */ =>
	`${data_model_storage.reference_symbol}${index}`;

/*
* Returns a complete tree rank name from a tree rank name (e.x Kingdom => $Kingdom)
* Opposite of get_name_from_tree_rank_name
* */
export const format_tree_rank = (
	rank_name: string,  // tree rank name to use
): string /* a complete tree rank name */ =>
	`${data_model_storage.tree_symbol}${rank_name[0].toUpperCase()}${rank_name.slice(1).toLowerCase()}`;

export const mapping_path_to_string = (
	mapping_path: MappingPath,
):string =>
	mapping_path.join(data_model_storage.path_join_symbol);


/* Iterates over the mappings_tree to find required fields that are missing */
export function show_required_missing_fields(
	table_name: string,  // Official name of the current base table (from data model)
	// Result of running mappings.get_mappings_tree() - an object with information about now mapped fields
	mappings_tree?: MappingsTree,
	previous_table_name = '',  // used internally in a recursion. Previous table name
	path: MappingPath = [],  // used internally in a recursion. Current mapping path
	results: string[][] = [],  // used internally in a recursion. Save results
): string[][] /* array of mapping paths (array) */ {

	const table_data = data_model_storage.tables[table_name];

	if (typeof mappings_tree === 'undefined')
		return results;

	const list_of_mapped_fields = Object.keys(mappings_tree);

	// handle -to-many references
	if (value_is_reference_item(list_of_mapped_fields[0])) {
		list_of_mapped_fields.forEach(mapped_field_name => {
			const local_path = [...path, mapped_field_name];
			if (typeof mappings_tree[mapped_field_name] === 'object')
				show_required_missing_fields(
					table_name,
					mappings_tree[mapped_field_name] as MappingsTree,
					previous_table_name,
					local_path,
					results,
				);
		});
		return results;
	}

	// handle trees
	else if (table_is_tree(table_name)) {

		const keys = Object.keys(data_model_storage.ranks[table_name]);
		const last_path_element = path.slice(-1)[0];
		const last_path_element_is_a_rank = value_is_tree_rank(last_path_element);

		if (!last_path_element_is_a_rank)
			return keys.reduce((results, rank_name) => {
				const is_rank_required = data_model_storage.ranks[table_name][rank_name];
				const complimented_rank_name = data_model_storage.tree_symbol + rank_name;
				const local_path = [...path, complimented_rank_name];

				if (list_of_mapped_fields.indexOf(complimented_rank_name) !== -1)
					show_required_missing_fields(
						table_name,
						mappings_tree[complimented_rank_name] as MappingsTree,
						previous_table_name,
						local_path,
						results,
					);
				else if (is_rank_required)
					results.push(local_path);

				return results;

			}, results);
	}

	// handle regular fields and relationships
	Object.entries(table_data.fields).some(([field_name, field_data]) => {

		const local_path = [...path, field_name];

		const is_mapped = list_of_mapped_fields.indexOf(field_name) !== -1;


		if (field_data.is_relationship) {


			if (previous_table_name !== '') {

				let previous_relationship_name = local_path.slice(-2)[0];
				if (
					value_is_reference_item(previous_relationship_name) ||
					value_is_tree_rank(previous_relationship_name)
				)
					previous_relationship_name = local_path.slice(-3)[0];

				const parent_relationship_data =
					data_model_storage.tables[previous_table_name].fields[previous_relationship_name] as DataModelRelationship;

				if (
					(  // disable circular relationships
						field_data.foreign_name === previous_relationship_name &&
						field_data.table_name === previous_table_name
					) ||
					(  // skip -to-many inside -to-many
						relationship_is_to_many(parent_relationship_data.type) &&
						relationship_is_to_many(field_data.type)
					)
				)
					return;

			}

			if (is_mapped)
				show_required_missing_fields(
					field_data.table_name,
					mappings_tree[field_name] as MappingsTree,
					table_name,
					local_path,
					results,
				);
			else if (field_data.is_required)
				results.push(local_path);
		}
		else if (!is_mapped && field_data.is_required)
			results.push(local_path);


	});

	return results;

}


export const is_circular_relationship_forwards = ({
	table_name,
	relationship_key,
	current_mapping_path_part,
}: {
	table_name?: string,
	relationship_key?: string,
	current_mapping_path_part?: string,
}):boolean =>
	data_model_storage.tables[table_name || '']?.
		fields[relationship_key || '']?.
		foreign_name === current_mapping_path_part || false;

export const is_circular_relationship_backwards = ({
	foreign_name,
	parent_table_name,
	relationship_key,
}: {
	foreign_name?: string,
	parent_table_name?: string,
	relationship_key?: string,
}):boolean =>
	data_model_storage.tables[parent_table_name || '']?.
		fields[foreign_name || '']?.
		foreign_name === relationship_key || false;

export const is_circular_relationship = ({
	target_table_name,
	parent_table_name,
	foreign_name,
	relationship_key,
	current_mapping_path_part,
	table_name,
}: {
	target_table_name?: string,
	parent_table_name?: string,
	foreign_name?: string,
	relationship_key?: string,
	current_mapping_path_part?: string,
	table_name?: string,
}):boolean =>
	target_table_name === parent_table_name &&
	(
		is_circular_relationship_backwards({parent_table_name, foreign_name, relationship_key}) ||
		is_circular_relationship_forwards({table_name, relationship_key, current_mapping_path_part})
	);

export const is_too_many_inside_of_too_many = (type?: RelationshipType, parent_type?: RelationshipType):boolean =>
	relationship_is_to_many(type) &&
	relationship_is_to_many(parent_type);