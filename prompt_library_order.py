"""Validated, copy-on-write moves in the shared prompt library tree."""
import copy
import json
import uuid


def move(data, operation):
    result = copy.deepcopy(data)
    libraries = result['libraries']

    def find(rows, key, label):
        found = next((row for row in rows if row['id'] == key), None)
        if found is None:
            raise ValueError(f'{label}不存在，请刷新后重试')
        return found

    def insert(rows, value, anchor_id, position):
        if anchor_id == value['id']:
            return
        anchor = find(rows, anchor_id, '目标位置') if anchor_id else None
        if value in rows:
            rows.remove(value)
        index = rows.index(anchor) + (position == 'after') if anchor else len(rows)
        rows.insert(index, value)

    kind = operation['kind']
    if kind not in ('library', 'category', 'item'):
        raise ValueError('无效的移动类型')
    if operation.get('position', 'before') not in ('before', 'after'):
        raise ValueError('无效的插入位置')
    source = find(libraries, operation['source_library_id'], '来源词库')
    target = find(libraries, operation.get('target_library_id') or source['id'], '目标词库')
    if source.get('readonly') or target.get('readonly'):
        raise ValueError('只读词库不能移动')
    anchor_id = operation.get('anchor_id', '')
    position = operation.get('position', 'before')
    item_id = operation['id']
    if kind == 'library':
        if item_id != source['id']:
            raise ValueError('来源词库不匹配')
        insert(libraries, source, anchor_id, position)
        return result, {'library_id': source['id']}

    def retain_state(item):
        if source is not target:
            item.setdefault('workbench_key', json.dumps([source['id'], item['id']], ensure_ascii=False, separators=(',', ':')))

    if kind == 'category':
        category = find(source['categories'], item_id, '分组')
        if source is target:
            insert(source['categories'], category, anchor_id, position)
            return result, {'library_id': target['id'], 'category_id': item_id}
        moving = [item for item in source['items'] if item.get('category') == item_id]
        target_ids = {item['id'] for item in target['items']}
        if any(item['id'] in target_ids for item in moving):
            raise ValueError('目标词库存在相同 ID 的提示词，未进行移动')
        # Category endpoints historically identify groups globally. Keep moved IDs unique.
        if any(cat['id'] == item_id for lib in libraries if lib is not source for cat in lib['categories']):
            category['id'] = 'pcat_' + uuid.uuid4().hex[:10]
        source['categories'].remove(category)
        insert(target['categories'], category, anchor_id, position)
        for item in moving:
            retain_state(item)
            item['category'] = category['id']
            source['items'].remove(item)
        target['items'].extend(moving)
        return result, {'library_id': target['id'], 'category_id': category['id']}

    item = find(source['items'], item_id, '提示词')
    if source is not target and any(row['id'] == item_id for row in target['items']):
        raise ValueError('目标词库存在相同 ID 的提示词，未进行移动')
    category_id = operation.get('target_category_id')
    if category_id is None:
        if source is not target:
            raise ValueError('跨库移动必须指定目标分组')
        category_id = item.get('category', 'custom')
    elif category_id:
        find(target['categories'], category_id, '目标分组')
    else:
        category = next((cat for cat in target['categories'] if cat['name'] == '未分组'), None)
        if category is None:
            category = {'id': 'pcat_' + uuid.uuid4().hex[:10], 'name': '未分组'}
            target['categories'].append(category)
        category_id = category['id']
    if anchor_id:
        anchor = find(target['items'], anchor_id, '目标提示词')
        if operation.get('target_category_id') and anchor.get('category') != category_id:
            raise ValueError('目标提示词已不在该分组，请刷新后重试')
    retain_state(item)
    item['category'] = category_id
    if source is not target:
        source['items'].remove(item)
    insert(target['items'], item, anchor_id, position)
    return result, {'library_id': target['id'], 'category_id': category_id, 'item_id': item_id}
